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


    function escapeJs(str) {
        if (str == null) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '')
            .replace(/\n/g, '');
    }

    function isParamDriven() {
        return !!(data.selectedStatusIds && data.selectedStatusIds.length);
    }

    function makeDragStartOnclick() {
        return "event.dataTransfer.setData('text/plain',this.getAttribute('data-opp-id')||'');" +
            "this.classList.add('kanban-card-dragging');" +
            "this.setAttribute('data-drag-active','1');";
    }

    function clearDropHovers() {
        return "var hovers=document.querySelectorAll('.kanban-column-body.kanban-drop-hover');" +
            "for(var hi=0;hi<hovers.length;hi++){hovers[hi].classList.remove('kanban-drop-hover');}";
    }

    function makeDragEndOnclick() {
        return "this.classList.remove('kanban-card-dragging');" +
            "var t=this;setTimeout(function(){t.removeAttribute('data-drag-active');},0);" +
            clearDropHovers();
    }

    function makeDragOverOnclick() {
        return "event.preventDefault();this.classList.add('kanban-drop-hover');";
    }

    function makeDragLeaveOnclick() {
        return "this.classList.remove('kanban-drop-hover');";
    }

    function recountVisibleColumnCounts() {
        return "var cols=c.querySelectorAll('.kanban-column');for(var k=0;k<cols.length;k++){" +
            "var n=0;var cc=cols[k].querySelectorAll('.kanban-card');" +
            "for(var m=0;m<cc.length;m++){if(cc[m].style.display!=='none')n++}" +
            "var cnt=cols[k].querySelector('.kanban-column-count');if(cnt)cnt.textContent=n}";
    }

    function makeExpandOnclick() {
        return "var c=document.getElementById('kanban-board-container');if(!c)return;" +
            "var bd=document.getElementById('kanban-board-backdrop');" +
            "var on=c.classList.toggle('kanban-board-expanded');" +
            "if(bd)bd.style.display=on?'block':'none';" +
            "this.setAttribute('aria-pressed',on?'true':'false');" +
            "this.setAttribute('aria-label',on?'Collapse board':'Expand board');" +
            "this.setAttribute('title',on?'Collapse board':'Expand board');" +
            "this.textContent=on?'Close':'Expand';";
    }

    function makeBackdropOnclick() {
        return "var c=document.getElementById('kanban-board-container');var bd=this;if(!c)return;" +
            "c.classList.remove('kanban-board-expanded');bd.style.display='none';" +
            "var btn=c.querySelector('.kanban-expand-btn');" +
            "if(btn){btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label','Expand board');" +
            "btn.setAttribute('title','Expand board');btn.textContent='Expand';}";
    }

    function toggleExpandBoard() {
        var c = document.getElementById('kanban-board-container');
        if (!c) return;
        var btn = c.querySelector('.kanban-expand-btn');
        var bd = document.getElementById('kanban-board-backdrop');
        var on = c.classList.toggle('kanban-board-expanded');
        if (bd) bd.style.display = on ? 'block' : 'none';
        if (btn) {
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', on ? 'Collapse board' : 'Expand board');
            btn.setAttribute('title', on ? 'Collapse board' : 'Expand board');
            btn.textContent = on ? 'Close' : 'Expand';
        }
    }

    function createExpandButton() {
        var expandBtn = document.createElement('div');
        expandBtn.className = 'kanban-expand-btn';
        expandBtn.setAttribute('role', 'button');
        expandBtn.setAttribute('tabindex', '0');
        expandBtn.setAttribute('aria-pressed', 'false');
        expandBtn.setAttribute('aria-label', 'Expand board');
        expandBtn.setAttribute('title', 'Expand board');
        expandBtn.textContent = 'Expand';
        expandBtn.setAttribute('onclick', makeExpandOnclick());
        expandBtn.onclick = function () { toggleExpandBoard(); };
        return expandBtn;
    }

    function ensureBackdrop(container) {
        var bd = document.getElementById('kanban-board-backdrop');
        if (bd) return bd;
        bd = document.createElement('div');
        bd.id = 'kanban-board-backdrop';
        bd.className = 'kanban-board-backdrop';
        bd.style.display = 'none';
        bd.setAttribute('onclick', makeBackdropOnclick());
        if (container.parentNode) {
            container.parentNode.insertBefore(bd, container);
        }
        return bd;
    }

    function makeDropOnclick(targetStatusId, updateUrl, allowedCsv, statusLabel) {
        var tid = escapeJs(targetStatusId);
        var url = escapeJs(updateUrl);
        var allowed = escapeJs(allowedCsv);
        var label = escapeJs(statusLabel || '');
        return "var e=event;var dropBody=this;e.preventDefault();e.stopPropagation();" +
            clearDropHovers() +
            "var tid='" + tid + "';var url='" + url + "';var allowed='" + allowed + "';" +
            "if(!/^\\d+$/.test(tid))return;" +
            "if(allowed){var parts=allowed.split(',');var ok=false;for(var ai=0;ai<parts.length;ai++){if(parts[ai]===tid){ok=true;break}}if(!ok){alert('That status is not allowed on this board.');return}}" +
            "var oid=e.dataTransfer.getData('text/plain');if(!/^\\d+$/.test(oid))return;" +
            "var c=document.getElementById('kanban-board-container');if(!c)return;" +
            "var card=null;var allCards=c.querySelectorAll('.kanban-card');for(var ci=0;ci<allCards.length;ci++){if(allCards[ci].getAttribute('data-opp-id')===oid){card=allCards[ci];break}}if(!card||card.getAttribute('data-saving')==='1')return;" +
            "var srcBody=card.parentNode;if(!srcBody)return;" +
            "var srcCol=srcBody.parentNode;var fromStatus=srcCol?srcCol.getAttribute('data-status'):'';" +
            "if(fromStatus===tid)return;" +
            "srcBody.removeChild(card);dropBody.appendChild(card);" +
            "card.setAttribute('data-saving','1');card.style.pointerEvents='none';" +
            recountVisibleColumnCounts() +
            "fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}," +
            "body:JSON.stringify({opportunityId:oid,fromStatusId:fromStatus,entitystatus:tid})})" +
            ".then(function(r){return r.json()})" +
            ".then(function(d){" +
            "card.removeAttribute('data-saving');card.style.pointerEvents='';" +
            "if(d&&d.ok){" +
            "var st='" + label + "';if(d.entitystatusText)st=d.entitystatusText;" +
            "var lt=st.toLowerCase();var tp='open';" +
            "if(lt.indexOf('closed won')>=0||lt.indexOf('closed - won')>=0)tp='won';" +
            "else if(lt.indexOf('closed lost')>=0||lt.indexOf('closed - lost')>=0)tp='lost';" +
            "card.setAttribute('data-status-type',tp);" +
            "}else{srcBody.appendChild(card);dropBody.removeChild(card);alert('Save failed: '+(d&&d.error?d.error:'unknown'));" +
            recountVisibleColumnCounts() +
            "}}).catch(function(err){srcBody.appendChild(card);dropBody.removeChild(card);card.removeAttribute('data-saving');card.style.pointerEvents='';" +
            "alert('Error: '+(err&&err.message?err.message:'network error'));" +
            recountVisibleColumnCounts() +
            "});" +
            "";
    }

    // ---- Self-contained filter logic ----
    // NetSuite renders portlets in an iframe, then extracts the HTML into the
    // main page. All JS references (window/document functions, addEventListener)
    // are lost. Only onclick attribute strings survive. This function generates
    // a self-contained onclick string that uses only built-in DOM APIs.

    function makeFilterOnclick(filterValue, hideEmptyCols) {
        var hideEmpty = hideEmptyCols ? "true" : "false";
        return "var hideEmpty=" + hideEmpty + ";var f='" + filterValue + "';" +
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
            "cols[k].style.display=(hideEmpty&&n===0)?'none':''}" +
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
        var hideEmptyCols = !isParamDriven();
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
            cols[k].style.display = (hideEmptyCols && n === 0) ? 'none' : '';
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
        card.setAttribute('data-entitystatus', String(opp.entitystatus || ''));

        // Self-contained onclick — survives portlet iframe extraction.
        if (opp.id) {
            var clickAttr =
                "if(this.getAttribute('data-drag-active')){this.removeAttribute('data-drag-active');return;}" +
                "var id=this.getAttribute('data-opp-id');" +
                "if(/^\\d+$/.test(id))" +
                "(window.top||window).location.href=" +
                "'/app/accounting/transactions/opprtnty.nl?id='+id";
            card.setAttribute('onclick', clickAttr);
            card.onclick = function () {
                if (card.getAttribute('data-drag-active')) {
                    card.removeAttribute('data-drag-active');
                    return;
                }
                var oppId = opp.id;
                if (!/^\d+$/.test(oppId)) return;
                var navUrl = '/app/accounting/transactions/opprtnty.nl?id=' + encodeURIComponent(oppId);
                (window.top || window).location.href = navUrl;
            };
        }

        if (data.updateUrl && opp.id) {
            card.setAttribute('draggable', 'true');
            card.setAttribute('ondragstart', makeDragStartOnclick());
            card.setAttribute('ondragend', makeDragEndOnclick());
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

        var paramDriven = isParamDriven();
        var hideEmptyCols = !paramDriven;
        var visibleColumns = paramDriven
            ? columns
            : columns.filter(function (col) {
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

        // Toolbar — filters left, expand right
        var toolbar = document.createElement('div');
        toolbar.className = 'kanban-toolbar';

        var filtersWrap = document.createElement('div');
        filtersWrap.className = 'kanban-toolbar-filters';

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
            btn.setAttribute('onclick', makeFilterOnclick(opt.value, hideEmptyCols));
            btn.onclick = function () { applyFilter(opt.value); };
            filtersWrap.appendChild(btn);
        });

        toolbar.appendChild(filtersWrap);
        toolbar.appendChild(createExpandButton());

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

            if (data.updateUrl) {
                bodyDiv.setAttribute('ondragover', makeDragOverOnclick());
                bodyDiv.setAttribute('ondragleave', makeDragLeaveOnclick());
                var allowedCsv = (data.allowedStatusIds || []).join(',');
                bodyDiv.setAttribute('ondrop', makeDropOnclick(col.id, data.updateUrl, allowedCsv, col.name));
            }

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

        ensureBackdrop(container);
        buildBoard(container);
    }

    init();
})();
