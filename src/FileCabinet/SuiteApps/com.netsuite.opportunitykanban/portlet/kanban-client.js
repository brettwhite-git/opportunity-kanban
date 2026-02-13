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
            "cols[k].style.display=n>0?'':'none'}";
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
