(function () {
    'use strict';

    if (window._kanbanInitialized) return;
    window._kanbanInitialized = true;

    var data = window.KANBAN_DATA;
    if (!data) {
        console.error('[Kanban] KANBAN_DATA not found');
        return;
    }

    // ---- Utilities ----

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function truncate(str, max) {
        if (!str) return '';
        return str.length <= max ? str : str.substring(0, max - 1) + '\u2026';
    }

    function formatCurrency(value) {
        if (!value && value !== 0) return '$0';
        var num = parseFloat(value);
        if (isNaN(num)) return '$0';
        if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
        return '$' + num.toFixed(0);
    }

    function formatFullCurrency(value) {
        if (!value && value !== 0) return '$0';
        var num = parseFloat(value);
        if (isNaN(num)) return '$0';
        var rounded = Math.round(num);
        return '$' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function classifyStatus(statusText) {
        if (!statusText) return 'open';
        var t = statusText.toLowerCase();
        if (t.indexOf('closed won') >= 0 || t.indexOf('closed - won') >= 0) return 'won';
        if (t.indexOf('closed lost') >= 0 || t.indexOf('closed - lost') >= 0) return 'lost';
        return 'open';
    }

    // ---- Self-contained filter logic ----
    // NetSuite renders portlets in an iframe, then extracts the HTML into the
    // main page. All JS references (window/document functions, addEventListener)
    // are lost. Only onclick attribute strings survive. This function generates
    // a self-contained onclick string that uses only built-in DOM APIs.

    function makeFilterOnclick(filterValue) {
        return "var f='" + filterValue + "';" +
            "var c=document.getElementById('kanban-board-container');" +
            "var cards=c.querySelectorAll('.kanban-card');" +
            "for(var i=0;i<cards.length;i++){" +
            "cards[i].style.display=(cards[i].getAttribute('data-cg').indexOf(f)>=0)?'':'none'}" +
            "var btns=c.querySelectorAll('.kanban-filter-btn');" +
            "for(var j=0;j<btns.length;j++){" +
            "btns[j].className='kanban-filter-btn'+(btns[j].getAttribute('data-filter')===f?' active':'');" +
            "btns[j].setAttribute('aria-pressed',btns[j].getAttribute('data-filter')===f?'true':'false')}" +
            "var cols=c.querySelectorAll('.kanban-column');" +
            "for(var k=0;k<cols.length;k++){" +
            "var n=0;var cc=cols[k].querySelectorAll('.kanban-card');" +
            "for(var m=0;m<cc.length;m++){if(cc[m].style.display!=='none')n++}" +
            "cols[k].querySelector('.kanban-column-count').textContent=n;" +
            "cols[k].style.display=n>0?'':'none'}" +
            "var sums={open:0,won:0,lost:0};" +
            "for(var i2=0;i2<cards.length;i2++){" +
            "if(cards[i2].style.display!=='none'){" +
            "var st=cards[i2].getAttribute('data-status-type')||'open';" +
            "var am=parseFloat(cards[i2].getAttribute('data-amount'))||0;" +
            "if(sums.hasOwnProperty(st))sums[st]+=am}}" +
            "var fmt=function(v){var r=Math.round(v);" +
            "return'$'+r.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')};" +
            "var oe=document.getElementById('kpi-open');" +
            "var we=document.getElementById('kpi-won');" +
            "var le=document.getElementById('kpi-lost');" +
            "if(oe)oe.textContent=fmt(sums.open);" +
            "if(we)we.textContent=fmt(sums.won);" +
            "if(le)le.textContent=fmt(sums.lost);";
    }

    // Equivalent JS function for jsdom test compatibility
    // (jsdom doesn't evaluate onclick attribute strings on .click())
    function applyFilter(filterValue) {
        var c = document.getElementById('kanban-board-container');
        if (!c) return;
        var cards = c.querySelectorAll('.kanban-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].style.display = (cards[i].getAttribute('data-cg').indexOf(filterValue) >= 0) ? '' : 'none';
        }
        var btns = c.querySelectorAll('.kanban-filter-btn');
        for (var j = 0; j < btns.length; j++) {
            btns[j].className = 'kanban-filter-btn' + (btns[j].getAttribute('data-filter') === filterValue ? ' active' : '');
            btns[j].setAttribute('aria-pressed', btns[j].getAttribute('data-filter') === filterValue ? 'true' : 'false');
        }
        var cols = c.querySelectorAll('.kanban-column');
        for (var k = 0; k < cols.length; k++) {
            var n = 0;
            var cc = cols[k].querySelectorAll('.kanban-card');
            for (var m = 0; m < cc.length; m++) {
                if (cc[m].style.display !== 'none') n++;
            }
            cols[k].querySelector('.kanban-column-count').textContent = n;
            cols[k].style.display = n > 0 ? '' : 'none';
        }
        updateKpis();
    }

    // ---- DOM Construction ----
    // All user-supplied data is escaped via escapeHtml() before insertion.
    // Data originates from server-side N/search results (trusted NetSuite data),
    // serialized through JSON.stringify with </script> sanitization in the portlet.

    function createCard(opp) {
        var card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('data-opp-id', opp.id);
        card.setAttribute('data-cg', opp.closeDateGroup || '');
        card.setAttribute('data-amount', opp.projectedtotal || '0');
        card.setAttribute('data-status-type', classifyStatus(opp.entitystatusText));

        var header = document.createElement('div');
        header.className = 'kanban-card-header';

        var tranid = document.createElement('a');
        tranid.className = 'kanban-card-tranid';
        tranid.textContent = opp.tranid || '';
        if (opp.id) {
            tranid.href = '/app/accounting/transactions/opprtnty.nl?id=' + encodeURIComponent(opp.id);
            tranid.target = '_blank';
            tranid.setAttribute('onclick', 'event.stopPropagation()');
            tranid.onclick = function (e) { e.stopPropagation(); };
        }

        var prob = document.createElement('span');
        prob.className = 'kanban-card-probability';
        prob.textContent = (opp.probability || '0') + '%';

        header.appendChild(tranid);
        header.appendChild(prob);

        var company = document.createElement('div');
        company.className = 'kanban-card-company';
        company.textContent = truncate(opp.companyname, 30);

        var footer = document.createElement('div');
        footer.className = 'kanban-card-footer';

        var dateEl = document.createElement('span');
        dateEl.className = 'kanban-card-date';
        dateEl.textContent = opp.expectedclosedate || '';

        var amount = document.createElement('span');
        amount.className = 'kanban-card-amount';
        amount.textContent = formatCurrency(opp.projectedtotal);

        footer.appendChild(dateEl);
        footer.appendChild(amount);

        card.appendChild(header);
        card.appendChild(company);
        card.appendChild(footer);

        // Self-contained onclick — no external function reference needed.
        // Uses only built-in browser APIs so it works after NetSuite
        // extracts portlet HTML from its rendering iframe.
        if (opp.id) {
            card.setAttribute('onclick',
                "var id=this.getAttribute('data-opp-id');" +
                "if(/^\\d+$/.test(id))" +
                "(window.top||window).location.href=" +
                "'/app/accounting/transactions/opprtnty.nl?id='+id");
            card.onclick = function () {
                var oppId = opp.id;
                if (!/^\d+$/.test(oppId)) return;
                var url = '/app/accounting/transactions/opprtnty.nl?id=' + encodeURIComponent(oppId);
                (window.top || window).location.href = url;
            };
        }

        return card;
    }

    // ---- KPI Cards ----

    function buildKpiRow() {
        var row = document.createElement('div');
        row.className = 'kanban-kpi-row';

        var kpis = [
            { id: 'kpi-open', label: 'Open Value' },
            { id: 'kpi-won', label: 'Closed Won' },
            { id: 'kpi-lost', label: 'Lost' }
        ];

        kpis.forEach(function (kpi) {
            var card = document.createElement('div');
            card.className = 'kanban-kpi-card';

            var label = document.createElement('div');
            label.className = 'kanban-kpi-label';
            label.textContent = kpi.label;

            var value = document.createElement('div');
            value.className = 'kanban-kpi-value';
            value.id = kpi.id;
            value.textContent = '$0';

            card.appendChild(label);
            card.appendChild(value);
            row.appendChild(card);
        });

        return row;
    }

    function updateKpis() {
        var c = document.getElementById('kanban-board-container');
        if (!c) return;
        var cards = c.querySelectorAll('.kanban-card');
        var sums = { open: 0, won: 0, lost: 0 };
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].style.display === 'none') continue;
            var type = cards[i].getAttribute('data-status-type') || 'open';
            var amt = parseFloat(cards[i].getAttribute('data-amount')) || 0;
            if (sums.hasOwnProperty(type)) sums[type] += amt;
        }
        var openEl = document.getElementById('kpi-open');
        var wonEl = document.getElementById('kpi-won');
        var lostEl = document.getElementById('kpi-lost');
        if (openEl) openEl.textContent = formatFullCurrency(sums.open);
        if (wonEl) wonEl.textContent = formatFullCurrency(sums.won);
        if (lostEl) lostEl.textContent = formatFullCurrency(sums.lost);
    }

    function buildBoard(container) {
        var columns = data.columns;
        var allOpps = data.opportunities;

        // Group ALL opportunities by status ID (no pre-filtering)
        var oppsByStatus = {};
        allOpps.forEach(function (opp) {
            var sid = String(opp.entitystatus);
            if (!oppsByStatus[sid]) oppsByStatus[sid] = [];
            oppsByStatus[sid].push(opp);
        });

        // Show only columns that have opps
        var visibleColumns = columns.filter(function (col) {
            return !!oppsByStatus[String(col.id)];
        });

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (visibleColumns.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'kanban-empty';
            empty.textContent = 'No opportunities found.';
            container.appendChild(empty);
            return;
        }

        // Toolbar — Quick Filter buttons (div, not button, to avoid NS form interception)
        var toolbar = document.createElement('div');
        toolbar.className = 'kanban-toolbar';

        var filterButtons = [
            { value: 'THIS_MONTH', text: 'This Month' },
            { value: 'THIS_QUARTER', text: 'This Quarter' },
            { value: 'NEXT_QUARTER', text: 'Next Quarter' },
            { value: 'LAST_QUARTER', text: 'Last Quarter' }
        ];
        filterButtons.forEach(function (opt) {
            var btn = document.createElement('div');
            btn.className = 'kanban-filter-btn' + (opt.value === 'THIS_MONTH' ? ' active' : '');
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-pressed', opt.value === 'THIS_MONTH' ? 'true' : 'false');
            btn.setAttribute('data-filter', opt.value);
            btn.textContent = opt.text;
            btn.setAttribute('onclick', makeFilterOnclick(opt.value));
            btn.onclick = function () { applyFilter(opt.value); };
            toolbar.appendChild(btn);
        });

        container.appendChild(buildKpiRow());
        container.appendChild(toolbar);

        // Columns wrapper
        var columnsDiv = document.createElement('div');
        columnsDiv.className = 'kanban-columns';

        visibleColumns.forEach(function (col) {
            var colOpps = oppsByStatus[String(col.id)] || [];

            var colDiv = document.createElement('div');
            colDiv.className = 'kanban-column';
            colDiv.setAttribute('data-status', col.id);

            var headerDiv = document.createElement('div');
            headerDiv.className = 'kanban-column-header';

            var titleSpan = document.createElement('span');
            titleSpan.className = 'kanban-column-title';
            titleSpan.textContent = col.name;

            var countSpan = document.createElement('span');
            countSpan.className = 'kanban-column-count';
            countSpan.textContent = String(colOpps.length);

            headerDiv.appendChild(titleSpan);
            headerDiv.appendChild(countSpan);

            var bodyDiv = document.createElement('div');
            bodyDiv.className = 'kanban-column-body';

            colOpps.forEach(function (opp) {
                bodyDiv.appendChild(createCard(opp));
            });

            colDiv.appendChild(headerDiv);
            colDiv.appendChild(bodyDiv);
            columnsDiv.appendChild(colDiv);
        });

        container.appendChild(columnsDiv);

        // Apply default filter so the board loads filtered to This Month
        applyFilter('THIS_MONTH');
    }

    // ---- Init ----

    function init() {
        var container = document.getElementById('kanban-board-container');
        if (!container) {
            console.error('[Kanban] kanban-board-container not found');
            return;
        }

        buildBoard(container);
    }

    init();
})();
