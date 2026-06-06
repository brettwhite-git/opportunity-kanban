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

    function formatCount(value) {
        var n = Math.round(parseFloat(value) || 0);
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

    /** Survives portlet iframe extraction — no external function references. */
    function inlineStopPropagation() {
        return "var evt=typeof event!=='undefined'?event:null;" +
            "if(evt&&evt.stopPropagation)evt.stopPropagation();";
    }

    function inlineClickApplyHook() {
        return "var h=document.getElementById('kanban-filter-apply-hook');if(h)h.click();";
    }

    function createFilterApplyHook(hideEmptyCols) {
        var hook = document.createElement('button');
        hook.type = 'button';
        hook.id = 'kanban-filter-apply-hook';
        hook.style.display = 'none';
        hook.setAttribute('aria-hidden', 'true');
        hook.setAttribute('tabindex', '-1');
        hook.setAttribute('onclick', inlineStopPropagation() + applyAllFiltersBody(hideEmptyCols));
        return hook;
    }

    /** NetSuite M/D/YYYY → ISO YYYY-MM-DD for range comparisons. */
    function normalizeCloseDateToIso(dateStr) {
        if (!dateStr) return '';
        var parts = String(dateStr).trim().split('/');
        if (parts.length !== 3) return '';
        var month = parseInt(parts[0], 10);
        var day = parseInt(parts[1], 10);
        var year = parseInt(parts[2], 10);
        if (!month || !day || !year) return '';
        var mm = month < 10 ? '0' + month : String(month);
        var dd = day < 10 ? '0' + day : String(day);
        return year + '-' + mm + '-' + dd;
    }

    function filterColumnKpiTail(hideEmptyCols) {
        var hideEmpty = hideEmptyCols ? 'true' : 'false';
        return "var hideEmpty=" + hideEmpty + ";" +
            "var cols=c.querySelectorAll('.kanban-column');" +
            "for(var k=0;k<cols.length;k++){" +
            "var n=0;var cc=cols[k].querySelectorAll('.kanban-card');" +
            "for(var m=0;m<cc.length;m++){if(cc[m].style.display!=='none')n++}" +
            "var cnt=cols[k].querySelector('.kanban-column-count');if(cnt)cnt.textContent=n;" +
            "cols[k].style.display=(hideEmpty&&n===0)?'none':''}" +
            recountVisibleKpis();
    }

    function makeDragStartOnclick() {
        return "var e=typeof event!=='undefined'?event:null;" +
            "if(e&&e.stopPropagation)e.stopPropagation();" +
            "if(this.getAttribute('data-period-locked')==='1'){if(e&&e.preventDefault)e.preventDefault();return false;}" +
            "if(e&&e.dataTransfer)e.dataTransfer.setData('text/plain',this.getAttribute('data-opp-id')||'');" +
            "this.classList.add('kanban-card-dragging');" +
            "this.setAttribute('data-drag-active','1');";
    }

    function clearDropHovers() {
        return "var hovers=document.querySelectorAll('.kanban-column-body.kanban-drop-hover');" +
            "for(var hi=0;hi<hovers.length;hi++){hovers[hi].classList.remove('kanban-drop-hover');}";
    }

    function makeDragEndOnclick() {
        return "var e=typeof event!=='undefined'?event:null;if(e&&e.stopPropagation)e.stopPropagation();" +
            "this.classList.remove('kanban-card-dragging');" +
            "var t=this;setTimeout(function(){t.removeAttribute('data-drag-active');},0);" +
            clearDropHovers();
    }

    function makeDragOverOnclick() {
        return "var e=typeof event!=='undefined'?event:null;" +
            "if(e&&e.preventDefault)e.preventDefault();if(e&&e.stopPropagation)e.stopPropagation();" +
            "this.classList.add('kanban-drop-hover');";
    }

    function makeDragLeaveOnclick() {
        return "var e=typeof event!=='undefined'?event:null;if(e&&e.stopPropagation)e.stopPropagation();" +
            "this.classList.remove('kanban-drop-hover');";
    }

    function recountVisibleColumnCounts() {
        return "var cols=c.querySelectorAll('.kanban-column');for(var k=0;k<cols.length;k++){" +
            "var n=0;var cc=cols[k].querySelectorAll('.kanban-card');" +
            "for(var m=0;m<cc.length;m++){if(cc[m].style.display!=='none')n++}" +
            "var cnt=cols[k].querySelector('.kanban-column-count');if(cnt)cnt.textContent=n}";
    }

    function recountVisibleKpis() {
        return "var kcards=c.querySelectorAll('.kanban-card');" +
            "var sums={open:0,won:0,lost:0};var oppCount=0;" +
            "for(var i2=0;i2<kcards.length;i2++){" +
            "if(kcards[i2].style.display!=='none'){" +
            "oppCount++;" +
            "var st=kcards[i2].getAttribute('data-status-type')||'open';" +
            "var am=parseFloat(kcards[i2].getAttribute('data-amount'))||0;" +
            "if(sums.hasOwnProperty(st))sums[st]+=am}}" +
            "var fmt=function(v){var r=Math.round(v);" +
            "return'$'+r.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')};" +
            "var fmtN=function(v){return String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')};" +
            "var ce=document.getElementById('kpi-count');" +
            "var oe=document.getElementById('kpi-open');" +
            "var we=document.getElementById('kpi-won');" +
            "var le=document.getElementById('kpi-lost');" +
            "if(ce)ce.textContent=fmtN(oppCount);" +
            "if(oe)oe.textContent=fmt(sums.open);" +
            "if(we)we.textContent=fmt(sums.won);" +
            "if(le)le.textContent=fmt(sums.lost);";
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
        return "var e=typeof event!=='undefined'?event:null;var dropBody=this;" +
            "if(e&&e.preventDefault)e.preventDefault();if(e&&e.stopPropagation)e.stopPropagation();" +
            "if(!e||!e.dataTransfer)return;" +
            clearDropHovers() +
            "var tid='" + tid + "';var url='" + url + "';var allowed='" + allowed + "';" +
            "if(!/^\\d+$/.test(tid))return;" +
            "if(allowed){var parts=allowed.split(',');var ok=false;for(var ai=0;ai<parts.length;ai++){if(parts[ai]===tid){ok=true;break}}if(!ok){alert('That status is not allowed on this board.');return}}" +
            "var oid=e.dataTransfer.getData('text/plain');if(!/^\\d+$/.test(oid))return;" +
            "var c=document.getElementById('kanban-board-container');if(!c)return;" +
            "var card=null;var allCards=c.querySelectorAll('.kanban-card');for(var ci=0;ci<allCards.length;ci++){if(allCards[ci].getAttribute('data-opp-id')===oid){card=allCards[ci];break}}if(!card||card.getAttribute('data-saving')==='1')return;" +
            "if(card.getAttribute('data-period-locked')==='1'){alert('This opportunity is in a closed accounting period and cannot be moved.');return;}" +
            "var srcBody=card.parentNode;if(!srcBody)return;" +
            "var srcCol=srcBody.parentNode;var fromStatus=srcCol?srcCol.getAttribute('data-status'):'';" +
            "if(fromStatus===tid)return;" +
            "try{if(card.parentNode!==dropBody){dropBody.appendChild(card);}}catch(moveEx){}" +
            recountVisibleColumnCounts() +
            "card.setAttribute('data-saving','1');card.style.pointerEvents='none';card.style.opacity='0.6';" +
            "var closedRanges=[];try{var cr=c.getAttribute('data-closed-ranges')||'';" +
            "if(cr)closedRanges=JSON.parse(decodeURIComponent(cr));}catch(closedEx){closedRanges=[];}" +
            "fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}," +
            "body:JSON.stringify({opportunityId:oid,fromStatusId:fromStatus,entitystatus:tid,closedAccountingRanges:closedRanges})})" +
            ".then(function(r){return r.json()})" +
            ".then(function(d){" +
            "card.removeAttribute('data-saving');card.style.pointerEvents='';card.style.opacity='';" +
            "if(d&&d.ok){" +
            "try{if(card.parentNode!==dropBody){dropBody.appendChild(card);}}catch(moveEx2){}" +
            "var st='" + label + "';if(d.entitystatusText)st=d.entitystatusText;" +
            "var lt=st.toLowerCase();var tp='open';" +
            "if(lt.indexOf('closed won')>=0||lt.indexOf('closed - won')>=0)tp='won';" +
            "else if(lt.indexOf('closed lost')>=0||lt.indexOf('closed - lost')>=0)tp='lost';" +
            "card.setAttribute('data-entitystatus',tid);" +
            "card.setAttribute('data-status-type',tp);" +
            "if(d.probability!=null&&String(d.probability)!==''){var prEl=card.querySelector('.kanban-card-probability');if(prEl)prEl.textContent=String(d.probability);}" +
            recountVisibleColumnCounts() +
            recountVisibleKpis() +
            "}else{try{if(srcBody&&card.parentNode!==srcBody){srcBody.appendChild(card);}}catch(revertEx){}" +
            recountVisibleColumnCounts() +
            "alert('Save failed: '+(d&&d.error?d.error:'unknown'));}" +
            "}).catch(function(err){card.removeAttribute('data-saving');card.style.pointerEvents='';card.style.opacity='';" +
            "try{if(srcBody&&card.parentNode!==srcBody){srcBody.appendChild(card);}}catch(revertEx2){}" +
            recountVisibleColumnCounts() +
            "alert('Error: '+(err&&err.message?err.message:'network error'));" +
            "});" +
            "";
    }

    // ---- Self-contained filter logic ----
    // NetSuite renders portlets in an iframe, then extracts the HTML into the
    // main page. All JS references (window/document functions, addEventListener)
    // are lost. Only onclick attribute strings survive. This function generates
    // a self-contained onclick string that uses only built-in DOM APIs.

    function formatIsoForBadge(iso) {
        if (!iso || iso.length < 10) return '';
        var parts = iso.split('-');
        if (parts.length !== 3) return iso;
        return parts[1] + '/' + parts[2] + '/' + parts[0];
    }

    /** NetSuite portlet HTML extraction preserves attributes, not .checked properties. */
    function setPeriodCheckboxChecked(checkbox, checked) {
        checkbox.checked = !!checked;
        if (checked) {
            checkbox.setAttribute('checked', 'checked');
        } else {
            checkbox.removeAttribute('checked');
        }
    }

    function syncPeriodCheckboxAttributesForGroup(group) {
        var cbs = document.querySelectorAll('.kanban-period-cb[data-period-group="' + group + '"]');
        for (var i = 0; i < cbs.length; i++) {
            if (cbs[i].checked) {
                cbs[i].setAttribute('checked', 'checked');
            } else {
                cbs[i].removeAttribute('checked');
            }
        }
    }

    function syncAllPeriodCheckboxAttributes() {
        syncPeriodCheckboxAttributesForGroup('acct');
        syncPeriodCheckboxAttributesForGroup('quarter');
    }

    function syncAllPeriodCheckboxAttributesBody() {
        return "var syncGrps=['acct','quarter'];for(var gi=0;gi<syncGrps.length;gi++){" +
            "var syncCbs=document.querySelectorAll('.kanban-period-cb[data-period-group=\"'+syncGrps[gi]+'\"]');" +
            "for(var si=0;si<syncCbs.length;si++){if(syncCbs[si].checked){syncCbs[si].setAttribute('checked','checked');}" +
            "else{syncCbs[si].removeAttribute('checked');}}}";
    }

    function preparePeriodPanelOnOpenBody() {
        return ensureDefaultPeriodsCheckedBody() + syncAllPeriodCheckboxAttributesBody();
    }

    function findTargetPeriodCheckbox(list, mv) {
        var root = document.getElementById('kanban-board-container');
        var defCsv = root
            ? (mv === 'quarter'
                ? (root.getAttribute('data-default-quarter-periods') || '')
                : (root.getAttribute('data-default-acct-periods') || ''))
            : '';
        var defs = defCsv ? defCsv.split(',') : [];
        var cb = null;
        var j;
        var pid;
        var checked;
        var i;
        for (j = defs.length - 1; j >= 0; j--) {
            if (!defs[j]) continue;
            cb = list.querySelector('.kanban-period-cb[data-period-id="' + defs[j] + '"]');
            if (cb) return cb;
        }
        checked = list.querySelectorAll('.kanban-period-cb:checked');
        for (i = 0; i < checked.length; i++) {
            pid = checked[i].getAttribute('data-period-id') || '';
            for (j = 0; j < defs.length; j++) {
                if (defs[j] && defs[j] === pid) {
                    return checked[i];
                }
            }
        }
        if (checked.length) {
            return checked[checked.length - 1];
        }
        return list.querySelector('.kanban-period-cb:checked');
    }

    function scrollPeriodListToCheckedRow(list, mv) {
        var listHeight = list.clientHeight || list.offsetHeight;
        if (listHeight < 1) return false;
        var cb = findTargetPeriodCheckbox(list, mv);
        if (!cb || !cb.parentElement) return false;
        var row = cb.parentElement;
        var top = row.offsetTop - (listHeight - row.offsetHeight) / 2;
        list.scrollTop = top > 0 ? top : 0;
        return true;
    }

    function schedulePeriodListScrollBody() {
        return "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "if(mv==='range')return;" +
            "var listId=mv==='quarter'?'kanban-filter-quarter-list':'kanban-filter-acct-list';" +
            "var list=document.getElementById(listId);if(!list)return;" +
            "var scrollTry=0;" +
            "var scrollTick=function(){" +
            "var listH=list.clientHeight||list.offsetHeight;" +
            "if(listH<1&&scrollTry<12){scrollTry++;setTimeout(scrollTick,20);return;}" +
            "var root=document.getElementById('kanban-board-container');" +
            "var defCsv=root?(mv==='quarter'?root.getAttribute('data-default-quarter-periods')||'':root.getAttribute('data-default-acct-periods')||''):'';" +
            "var defs=defCsv?defCsv.split(','):[];" +
            "var cb=null;var pj,rid,si,pid;" +
            "for(pj=defs.length-1;pj>=0;pj--){if(!defs[pj])continue;rid=defs[pj];" +
            "cb=list.querySelector('.kanban-period-cb[data-period-id=\"'+rid+'\"]');if(cb)break;}" +
            "if(!cb){var checked=list.querySelectorAll('.kanban-period-cb:checked');" +
            "for(si=0;si<checked.length;si++){pid=checked[si].getAttribute('data-period-id')||'';" +
            "for(pj=0;pj<defs.length;pj++){if(defs[pj]&&defs[pj]===pid){cb=checked[si];break;}}if(cb)break;}" +
            "if(!cb&&checked.length)cb=checked[checked.length-1];}" +
            "if(!cb)cb=list.querySelector('.kanban-period-cb:checked');" +
            "if(!cb||!cb.parentElement)return;" +
            "var row=cb.parentElement;var top=row.offsetTop-(listH-row.offsetHeight)/2;" +
            "list.scrollTop=top>0?top:0;};" +
            "setTimeout(scrollTick,0);";
    }

    function scrollActivePeriodListIntoViewBody() {
        return schedulePeriodListScrollBody();
    }

    function applyDefaultRangeDatesBody(forceAssign) {
        var startIso = escapeJs(data.defaultRangeStartIso || '');
        var endIso = escapeJs(data.defaultRangeEndIso || '');
        if (!startIso || !endIso) return '';
        if (forceAssign) {
            return "var rs=document.getElementById('kanban-date-start');var re=document.getElementById('kanban-date-end');" +
                "if(rs)rs.value='" + startIso + "';if(re)re.value='" + endIso + "';";
        }
        return "var rs=document.getElementById('kanban-date-start');var re=document.getElementById('kanban-date-end');" +
            "if(rs&&!rs.value)rs.value='" + startIso + "';" +
            "if(re&&!re.value)re.value='" + endIso + "';";
    }

    function makeSyncFilterModeUiBody() {
        return "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "var acctList=document.getElementById('kanban-filter-acct-list');" +
            "var qtrList=document.getElementById('kanban-filter-quarter-list');" +
            "var rangeList=document.getElementById('kanban-filter-range-list');" +
            "if(acctList)acctList.style.display=mv==='acct'?'block':'none';" +
            "if(qtrList)qtrList.style.display=mv==='quarter'?'block':'none';" +
            "if(rangeList)rangeList.style.display=mv==='range'?'flex':'none';" +
            "var ba=document.getElementById('kanban-filter-mode-acct');" +
            "var bq=document.getElementById('kanban-filter-mode-quarter');" +
            "var br=document.getElementById('kanban-filter-mode-range');" +
            "if(ba)ba.className='kanban-filter-mode-btn'+(mv==='acct'?' active':'');" +
            "if(bq)bq.className='kanban-filter-mode-btn'+(mv==='quarter'?' active':'');" +
            "if(br)br.className='kanban-filter-mode-btn'+(mv==='range'?' active':'');" +
            scrollActivePeriodListIntoViewBody();
    }

    function ensureDefaultPeriodsCheckedBody() {
        return "var root=document.getElementById('kanban-board-container');" +
            "var defAcct=root?root.getAttribute('data-default-acct-periods')||'':'';" +
            "var defQ=root?root.getAttribute('data-default-quarter-periods')||'':'';" +
            "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "if(mv!=='range'){" +
            "var grp=mv==='quarter'?'quarter':'acct';" +
            "var defs=(mv==='quarter'?defQ:defAcct).split(',');" +
            "var cbs=document.querySelectorAll('.kanban-period-cb[data-period-group=\"'+grp+'\"]');" +
            "var any=false;for(var di=0;di<cbs.length;di++){if(cbs[di].checked){any=true;break;}}" +
            "if(!any){for(var dj=0;dj<cbs.length;dj++){" +
            "var pid=cbs[dj].getAttribute('data-period-id')||'';" +
            "for(var dk=0;dk<defs.length;dk++){if(defs[dk]&&defs[dk]===pid){cbs[dj].checked=true;" +
            "cbs[dj].setAttribute('checked','checked');break;}}}}}";
    }

    function ensureDefaultPeriodsChecked() {
        var root = document.getElementById('kanban-board-container');
        var defAcct = root ? (root.getAttribute('data-default-acct-periods') || '') : '';
        var defQ = root ? (root.getAttribute('data-default-quarter-periods') || '') : '';
        var modeEl = document.getElementById('kanban-filter-mode');
        var mv = modeEl ? modeEl.value : 'acct';
        if (mv === 'range') return;
        var group = mv === 'quarter' ? 'quarter' : 'acct';
        var defs = (mv === 'quarter' ? defQ : defAcct).split(',').filter(Boolean);
        var checkboxes = document.querySelectorAll('.kanban-period-cb[data-period-group="' + group + '"]');
        var anyChecked = false;
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked) {
                anyChecked = true;
                break;
            }
        }
        if (anyChecked) return;
        for (var j = 0; j < checkboxes.length; j++) {
            var periodId = checkboxes[j].getAttribute('data-period-id') || '';
            for (var k = 0; k < defs.length; k++) {
                if (defs[k] === periodId) {
                    setPeriodCheckboxChecked(checkboxes[j], true);
                    break;
                }
            }
        }
    }

    function updateFilterChipLabelBody() {
        return "var trig=document.getElementById('kanban-filter-trigger');if(!trig)return;" +
            "var wrap=trig.parentElement;var lbl=document.getElementById('kanban-filter-chip-label');" +
            "var val=document.getElementById('kanban-filter-chip-value');var sep=document.getElementById('kanban-filter-chip-sep');" +
            "var clr=document.getElementById('kanban-filter-chip-clear');" +
            "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "var active=false;var showClear=false;var label='Period';var value='Select period';" +
            "function fmtIso(iso){if(!iso||iso.length<10)return '';var p=iso.split('-');return p[1]+'/'+p[2]+'/'+p[0];}" +
            "if(mv==='range'){label='Close date';" +
            "var rs=document.getElementById('kanban-date-start');var re=document.getElementById('kanban-date-end');" +
            "var rsv=rs?rs.value:'';var rev=re?re.value:'';" +
            "if(rsv&&rev){value=fmtIso(rsv)+' \\u2013 '+fmtIso(rev);active=true;showClear=true;}else{value='Select range';}" +
            "}else{label=mv==='quarter'?'Quarter':'Period';" +
            "var sel=document.querySelectorAll('.kanban-period-cb[data-period-group='+mv+']:checked');" +
            "if(sel.length===1){var row=sel[0].parentElement;value=row?row.textContent.replace(/^\\s+/,'').trim():'Selected';active=true;showClear=true;}" +
            "else if(sel.length>1){value=String(sel.length);active=true;showClear=true;}}" +
            "if(lbl)lbl.textContent=label;if(val)val.textContent=value;" +
            "trig.className='kanban-filter-chip'+(active?' active':'');" +
            "if(sep)sep.style.display='';if(clr)clr.style.display=showClear?'':'none';" +
            "if(wrap&&(' '+wrap.className+' ').indexOf(' kanban-filter-chip-wrap ')>=0){" +
            "wrap.className='kanban-filter-chip-wrap'+(active?' active':'')+(showClear?' has-clear':'');}";
    }

    function applyAllFiltersBody(hideEmptyCols) {
        return ensureDefaultPeriodsCheckedBody() +
            "var c=document.getElementById('kanban-board-container');if(!c)return;" +
            "var cards=c.querySelectorAll('.kanban-card');" +
            "var ranges=[];var useRange=false;var badRange=false;var rs='';var re='';" +
            "var searchEl=document.getElementById('kanban-search');" +
            "var q=searchEl?(searchEl.value||'').trim().toLowerCase():'';" +
            "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "if(mv==='range'){" +
            "var startEl=document.getElementById('kanban-date-start');var endEl=document.getElementById('kanban-date-end');" +
            "rs=startEl?startEl.value:'';re=endEl?endEl.value:'';useRange=!!(rs&&re);badRange=useRange&&rs>re;" +
            "}else{" +
            "var cbs=document.querySelectorAll('.kanban-period-cb[data-period-group=\"'+mv+'\"]');" +
            "for(var ci=0;ci<cbs.length;ci++){if(cbs[ci].checked){" +
            "var s=cbs[ci].getAttribute('data-start');var pe=cbs[ci].getAttribute('data-end');" +
            "if(s&&pe)ranges.push({s:s,e:pe});}}}" +
            "for(var i=0;i<cards.length;i++){" +
            "var d=cards[i].getAttribute('data-close-date')||'';" +
            "var show=false;" +
            "if(mv==='range'){" +
            "if(!useRange||badRange){show=true;}" +
            "else{show=!!(d&&rs<=d&&d<=re);}" +
            "}else{" +
            "if(!ranges.length){show=true;}" +
            "else{for(var ri=0;ri<ranges.length;ri++){if(d&&ranges[ri].s<=d&&d<=ranges[ri].e){show=true;break;}}}" +
            "}" +
            "if(show&&q){var st=cards[i].getAttribute('data-search-text')||'';if(st.indexOf(q)<0)show=false;}" +
            "cards[i].style.display=show?'':'none';}" +
            updateFilterChipLabelBody() +
            filterColumnKpiTail(hideEmptyCols) +
            syncAllPeriodCheckboxAttributesBody();
    }

    function makeApplyFiltersTriggerOnclick() {
        return inlineStopPropagation() + inlineClickApplyHook();
    }

    function makeFilterApplyOninput() {
        return inlineClickApplyHook();
    }

    function makeFilterClearOnclick(hideEmptyCols, defaultAcctCsv, defaultQuarterCsv, defaultRangeStart, defaultRangeEnd) {
        var acctCsv = escapeJs(defaultAcctCsv);
        var quarterCsv = escapeJs(defaultQuarterCsv);
        var rangeStart = escapeJs(defaultRangeStart || '');
        var rangeEnd = escapeJs(defaultRangeEnd || '');
        return inlineStopPropagation() +
            "var modeEl=document.getElementById('kanban-filter-mode');var mv=modeEl?modeEl.value:'acct';" +
            "if(mv==='range'){" +
            (rangeStart && rangeEnd
                ? "var rs=document.getElementById('kanban-date-start');var re=document.getElementById('kanban-date-end');" +
                    "if(rs)rs.value='" + rangeStart + "';if(re)re.value='" + rangeEnd + "';"
                : "var rs=document.getElementById('kanban-date-start');var re=document.getElementById('kanban-date-end');" +
                    "if(rs)rs.value='';if(re)re.value='';") +
            "}else{" +
            "var grp=mv==='quarter'?'quarter':'acct';" +
            "var defCsv=mv==='quarter'?'" + quarterCsv + "':'" + acctCsv + "';" +
            "var defs=defCsv?defCsv.split(','):[];" +
            "var cbs=document.querySelectorAll('.kanban-period-cb[data-period-group='+grp+']');" +
            "for(var xi=0;xi<cbs.length;xi++){cbs[xi].checked=false;cbs[xi].removeAttribute('checked');}" +
            "for(var xj=0;xj<cbs.length;xj++){" +
            "var pid=cbs[xj].getAttribute('data-period-id')||'';" +
            "for(var xk=0;xk<defs.length;xk++){if(defs[xk]&&defs[xk]===pid){cbs[xj].checked=true;" +
            "cbs[xj].setAttribute('checked','checked');break;}}}" +
            "}" +
            inlineClickApplyHook();
    }

    function makeFilterModeOnclick(mode, hideEmptyCols) {
        var rangeDefault = mode === 'range' ? applyDefaultRangeDatesBody(false) : '';
        return inlineStopPropagation() +
            "var m=document.getElementById('kanban-filter-mode');if(m)m.value='" + escapeJs(mode) + "';" +
            rangeDefault +
            makeSyncFilterModeUiBody() +
            inlineClickApplyHook();
    }

    function makePeriodPanelToggleOnclick(panelId) {
        var pid = escapeJs(panelId);
        return inlineStopPropagation() +
            "var p=document.getElementById('" + pid + "');if(!p)return;" +
            "var open=p.style.display!=='none';" +
            closeAllPeriodPanelsBody() +
            "if(!open){p.style.display='block';" + preparePeriodPanelOnOpenBody() +
            scrollActivePeriodListIntoViewBody() + "}";
    }

    function makeClosePeriodPanelsOnclick() {
        return "if(document.querySelector('.kanban-card-dragging,[data-drag-active]'))return;" +
            "var e=typeof event!=='undefined'?event:null;var t=e&&e.target;if(!t)return;" +
            "var el=t;var inside=false;" +
            "while(el){var cn=el.className;if(cn&&(' '+cn+' ').indexOf(' kanban-period-dropdown ')>=0){inside=true;break;}el=el.parentElement;}" +
            "if(inside)return;" +
            closeAllPeriodPanelsBody() +
            inlineClickApplyHook();
    }

    function clearActiveFilter(hideEmptyCols, defaultAcctIds, defaultQuarterIds) {
        var modeEl = document.getElementById('kanban-filter-mode');
        var mv = modeEl ? modeEl.value : 'acct';
        if (mv === 'range') {
            applyDefaultRangeDates(true);
        } else {
            var group = mv === 'quarter' ? 'quarter' : 'acct';
            var defs = mv === 'quarter' ? defaultQuarterIds : defaultAcctIds;
            var checkboxes = document.querySelectorAll('.kanban-period-cb[data-period-group="' + group + '"]');
            for (var i = 0; i < checkboxes.length; i++) {
                setPeriodCheckboxChecked(checkboxes[i], false);
            }
            for (var j = 0; j < checkboxes.length; j++) {
                var periodId = checkboxes[j].getAttribute('data-period-id') || '';
                for (var k = 0; k < defs.length; k++) {
                    if (defs[k] && defs[k] === periodId) {
                        setPeriodCheckboxChecked(checkboxes[j], true);
                        break;
                    }
                }
            }
        }
        applyAllFilters();
    }

    function scrollActivePeriodListIntoView() {
        var modeEl = document.getElementById('kanban-filter-mode');
        var mv = modeEl ? modeEl.value : 'acct';
        if (mv === 'range') return;
        var listId = mv === 'quarter' ? 'kanban-filter-quarter-list' : 'kanban-filter-acct-list';
        var list = document.getElementById(listId);
        if (!list) return;
        var attempts = 0;
        function tryScroll() {
            if (scrollPeriodListToCheckedRow(list, mv)) return;
            if (attempts < 12) {
                attempts += 1;
                setTimeout(tryScroll, 20);
            }
        }
        setTimeout(tryScroll, 0);
    }

    function applyDefaultRangeDates(forceAssign) {
        var startIso = data.defaultRangeStartIso || '';
        var endIso = data.defaultRangeEndIso || '';
        if (!startIso || !endIso) return;
        var startEl = document.getElementById('kanban-date-start');
        var endEl = document.getElementById('kanban-date-end');
        if (startEl && (forceAssign || !startEl.value)) startEl.value = startIso;
        if (endEl && (forceAssign || !endEl.value)) endEl.value = endIso;
    }

    function syncFilterModeUi() {
        var modeEl = document.getElementById('kanban-filter-mode');
        var mv = modeEl ? modeEl.value : 'acct';
        var acctList = document.getElementById('kanban-filter-acct-list');
        var qtrList = document.getElementById('kanban-filter-quarter-list');
        var rangeList = document.getElementById('kanban-filter-range-list');
        if (acctList) acctList.style.display = mv === 'acct' ? 'block' : 'none';
        if (qtrList) qtrList.style.display = mv === 'quarter' ? 'block' : 'none';
        if (rangeList) rangeList.style.display = mv === 'range' ? 'flex' : 'none';
        var ba = document.getElementById('kanban-filter-mode-acct');
        var bq = document.getElementById('kanban-filter-mode-quarter');
        var br = document.getElementById('kanban-filter-mode-range');
        if (ba) ba.className = 'kanban-filter-mode-btn' + (mv === 'acct' ? ' active' : '');
        if (bq) bq.className = 'kanban-filter-mode-btn' + (mv === 'quarter' ? ' active' : '');
        if (br) br.className = 'kanban-filter-mode-btn' + (mv === 'range' ? ' active' : '');
        scrollActivePeriodListIntoView();
    }

    function setFilterMode(mode, hideEmptyCols) {
        var modeEl = document.getElementById('kanban-filter-mode');
        if (modeEl) modeEl.value = mode;
        if (mode === 'range') applyDefaultRangeDates(false);
        syncFilterModeUi();
        applyAllFilters();
    }

    function updateFilterChipLabel() {
        var trig = document.getElementById('kanban-filter-trigger');
        if (!trig) return;

        var wrap = trig.parentElement;
        var labelEl = document.getElementById('kanban-filter-chip-label');
        var valueEl = document.getElementById('kanban-filter-chip-value');
        var sepEl = document.getElementById('kanban-filter-chip-sep');
        var clearEl = document.getElementById('kanban-filter-chip-clear');
        var modeEl = document.getElementById('kanban-filter-mode');
        var mv = modeEl ? modeEl.value : 'acct';
        var active = false;
        var showClear = false;

        if (mv === 'range') {
            if (labelEl) labelEl.textContent = 'Close date';
            var startEl = document.getElementById('kanban-date-start');
            var endEl = document.getElementById('kanban-date-end');
            var rangeStart = startEl ? startEl.value : '';
            var rangeEnd = endEl ? endEl.value : '';
            if (rangeStart && rangeEnd) {
                if (valueEl) {
                    valueEl.textContent = formatIsoForBadge(rangeStart) + ' \u2013 ' + formatIsoForBadge(rangeEnd);
                }
                active = true;
                showClear = true;
            } else if (valueEl) {
                valueEl.textContent = 'Select range';
            }
        } else {
            if (labelEl) labelEl.textContent = mv === 'quarter' ? 'Quarter' : 'Period';
            var selected = document.querySelectorAll('.kanban-period-cb[data-period-group="' + mv + '"]:checked');
            if (selected.length === 0) {
                if (valueEl) valueEl.textContent = 'Select period';
            } else if (selected.length === 1) {
                var row = selected[0].parentElement;
                var text = row ? row.textContent.replace(/^\s+/, '').trim() : '';
                if (valueEl) valueEl.textContent = text || 'Selected';
                active = true;
                showClear = true;
            } else {
                if (valueEl) valueEl.textContent = String(selected.length);
                active = true;
                showClear = true;
            }
        }

        trig.className = 'kanban-filter-chip' + (active ? ' active' : '');
        if (sepEl) sepEl.style.display = '';
        if (clearEl) clearEl.style.display = showClear ? '' : 'none';
        if (wrap && (' ' + wrap.className + ' ').indexOf(' kanban-filter-chip-wrap ') >= 0) {
            wrap.className = 'kanban-filter-chip-wrap' + (active ? ' active' : '') + (showClear ? ' has-clear' : '');
        }
    }

    function closeAllPeriodPanelsBody() {
        return "var panels=document.querySelectorAll('.kanban-period-panel');" +
            "for(var pi=0;pi<panels.length;pi++){panels[pi].style.display='none';}";
    }

    function closeAllPeriodPanels() {
        var panels = document.querySelectorAll('.kanban-period-panel');
        for (var pi = 0; pi < panels.length; pi++) {
            panels[pi].style.display = 'none';
        }
    }

    function togglePeriodPanel(panelId) {
        var panel = document.getElementById(panelId);
        if (!panel) return;
        var open = panel.style.display !== 'none';
        closeAllPeriodPanels();
        if (!open) {
            panel.style.display = 'block';
            ensureDefaultPeriodsChecked();
            syncAllPeriodCheckboxAttributes();
            scrollActivePeriodListIntoView();
        }
    }

    function applyAllFilters() {
        var hideEmptyCols = !isParamDriven();
        var c = document.getElementById('kanban-board-container');
        if (!c) return;

        ensureDefaultPeriodsChecked();

        var modeEl = document.getElementById('kanban-filter-mode');
        var mode = modeEl ? modeEl.value : 'acct';

        var cards = c.querySelectorAll('.kanban-card');
        var ranges = [];
        var rangeStart = '';
        var rangeEnd = '';
        var useRange = false;
        var badRange = false;
        var searchEl = document.getElementById('kanban-search');
        var searchQ = searchEl ? (searchEl.value || '').trim().toLowerCase() : '';

        if (mode === 'range') {
            var startEl = document.getElementById('kanban-date-start');
            var endEl = document.getElementById('kanban-date-end');
            rangeStart = startEl ? startEl.value : '';
            rangeEnd = endEl ? endEl.value : '';
            useRange = !!(rangeStart && rangeEnd);
            badRange = useRange && rangeStart > rangeEnd;
        } else {
            var checkboxes = c.querySelectorAll('.kanban-period-cb[data-period-group="' + mode + '"]');
            for (var ci = 0; ci < checkboxes.length; ci++) {
                if (!checkboxes[ci].checked) continue;
                var start = checkboxes[ci].getAttribute('data-start');
                var end = checkboxes[ci].getAttribute('data-end');
                if (start && end) ranges.push({ s: start, e: end });
            }
        }

        for (var i = 0; i < cards.length; i++) {
            var closeDate = cards[i].getAttribute('data-close-date') || '';
            var show = false;
            if (mode === 'range') {
                if (!useRange || badRange) {
                    show = true;
                } else {
                    show = !!(closeDate && rangeStart <= closeDate && closeDate <= rangeEnd);
                }
            } else if (ranges.length === 0) {
                show = true;
            } else {
                for (var ri = 0; ri < ranges.length; ri++) {
                    if (closeDate && ranges[ri].s <= closeDate && closeDate <= ranges[ri].e) {
                        show = true;
                        break;
                    }
                }
            }
            if (show && searchQ) {
                var searchText = cards[i].getAttribute('data-search-text') || '';
                if (searchText.indexOf(searchQ) < 0) show = false;
            }
            cards[i].style.display = show ? '' : 'none';
        }

        updateFilterChipLabel();
        applyColumnVisibility(hideEmptyCols);
        updateKpis();
        syncAllPeriodCheckboxAttributes();
    }

    function applyColumnVisibility(hideEmptyCols) {
        var c = document.getElementById('kanban-board-container');
        if (!c) return;
        var cols = c.querySelectorAll('.kanban-column');
        for (var k = 0; k < cols.length; k++) {
            var n = 0;
            var cc = cols[k].querySelectorAll('.kanban-card');
            for (var m = 0; m < cc.length; m++) {
                if (cc[m].style.display !== 'none') n++;
            }
            var cnt = cols[k].querySelector('.kanban-column-count');
            if (cnt) cnt.textContent = n;
            cols[k].style.display = (hideEmptyCols && n === 0) ? 'none' : '';
        }
    }

    function appendPeriodCheckboxes(listEl, group, periods, defaultIds, hideEmptyCols) {
        (periods || []).forEach(function (period) {
            var row = document.createElement('label');
            row.className = 'kanban-period-option';

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'kanban-period-cb';
            checkbox.setAttribute('data-period-group', group);
            checkbox.setAttribute('data-period-id', period.id);
            checkbox.setAttribute('data-start', period.startIso);
            checkbox.setAttribute('data-end', period.endIso);
            setPeriodCheckboxChecked(checkbox, defaultIds.indexOf(period.id) >= 0);
            checkbox.setAttribute('onclick', makeApplyFiltersTriggerOnclick());

            row.appendChild(checkbox);
            row.appendChild(document.createTextNode(' ' + period.name));
            listEl.appendChild(row);
        });
    }

    function createSearchInput(hideEmptyCols) {
        var search = document.createElement('input');
        search.type = 'search';
        search.id = 'kanban-search';
        search.className = 'kanban-search-input';
        search.setAttribute('placeholder', 'Search opportunities');
        search.setAttribute('aria-label', 'Search opportunities');
        search.setAttribute('oninput', makeFilterApplyOninput());
        return search;
    }

    function createUnifiedFilterChip(hideEmptyCols) {
        var defaultAcctIds = data.defaultAccountingPeriodIds || [];
        var defaultQuarterIds = data.defaultQuarterPeriodIds || [];
        var defaultAcctCsv = defaultAcctIds.join(',');
        var defaultQuarterCsv = defaultQuarterIds.join(',');
        var defaultRangeStart = data.defaultRangeStartIso || '';
        var defaultRangeEnd = data.defaultRangeEndIso || '';

        var wrap = document.createElement('div');
        wrap.className = 'kanban-period-dropdown';

        var chipWrap = document.createElement('div');
        chipWrap.className = 'kanban-filter-chip-wrap has-clear active';

        var trigger = document.createElement('div');
        trigger.className = 'kanban-filter-chip active';
        trigger.id = 'kanban-filter-trigger';
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('onclick', makePeriodPanelToggleOnclick('kanban-filter-panel'));

        var chipLabel = document.createElement('span');
        chipLabel.className = 'kanban-filter-chip-label';
        chipLabel.id = 'kanban-filter-chip-label';
        chipLabel.textContent = 'Period';

        var chipSep = document.createElement('span');
        chipSep.className = 'kanban-filter-chip-sep';
        chipSep.id = 'kanban-filter-chip-sep';
        chipSep.textContent = '';

        var chipValue = document.createElement('span');
        chipValue.className = 'kanban-filter-chip-value';
        chipValue.id = 'kanban-filter-chip-value';
        chipValue.textContent = 'Select period';

        trigger.appendChild(chipLabel);
        trigger.appendChild(chipSep);
        trigger.appendChild(chipValue);

        var chipClear = document.createElement('div');
        chipClear.className = 'kanban-filter-chip-clear';
        chipClear.id = 'kanban-filter-chip-clear';
        chipClear.setAttribute('role', 'button');
        chipClear.setAttribute('tabindex', '0');
        chipClear.setAttribute('aria-label', 'Clear filter');
        chipClear.textContent = '\u00d7';
        chipClear.setAttribute('onclick', makeFilterClearOnclick(
            hideEmptyCols,
            defaultAcctCsv,
            defaultQuarterCsv,
            defaultRangeStart,
            defaultRangeEnd
        ));

        chipWrap.appendChild(trigger);
        chipWrap.appendChild(chipClear);

        var panel = document.createElement('div');
        panel.className = 'kanban-period-panel kanban-filter-panel';
        panel.id = 'kanban-filter-panel';
        panel.style.display = 'none';
        panel.setAttribute('onclick', inlineStopPropagation());

        var modeInput = document.createElement('input');
        modeInput.type = 'hidden';
        modeInput.id = 'kanban-filter-mode';
        modeInput.value = 'acct';
        panel.appendChild(modeInput);

        var modeBar = document.createElement('div');
        modeBar.className = 'kanban-filter-mode-bar';

        var acctModeBtn = document.createElement('div');
        acctModeBtn.id = 'kanban-filter-mode-acct';
        acctModeBtn.className = 'kanban-filter-mode-btn active';
        acctModeBtn.setAttribute('role', 'button');
        acctModeBtn.setAttribute('tabindex', '0');
        acctModeBtn.textContent = 'Period';
        acctModeBtn.setAttribute('onclick', makeFilterModeOnclick('acct', hideEmptyCols));

        var quarterModeBtn = document.createElement('div');
        quarterModeBtn.id = 'kanban-filter-mode-quarter';
        quarterModeBtn.className = 'kanban-filter-mode-btn';
        quarterModeBtn.setAttribute('role', 'button');
        quarterModeBtn.setAttribute('tabindex', '0');
        quarterModeBtn.textContent = 'Quarter';
        quarterModeBtn.setAttribute('onclick', makeFilterModeOnclick('quarter', hideEmptyCols));

        var rangeModeBtn = document.createElement('div');
        rangeModeBtn.id = 'kanban-filter-mode-range';
        rangeModeBtn.className = 'kanban-filter-mode-btn';
        rangeModeBtn.setAttribute('role', 'button');
        rangeModeBtn.setAttribute('tabindex', '0');
        rangeModeBtn.textContent = 'Close date';
        rangeModeBtn.setAttribute('onclick', makeFilterModeOnclick('range', hideEmptyCols));

        modeBar.appendChild(acctModeBtn);
        modeBar.appendChild(quarterModeBtn);
        modeBar.appendChild(rangeModeBtn);
        panel.appendChild(modeBar);

        var acctList = document.createElement('div');
        acctList.id = 'kanban-filter-acct-list';
        acctList.className = 'kanban-filter-period-list';
        appendPeriodCheckboxes(
            acctList,
            'acct',
            data.accountingPeriods || [],
            data.defaultAccountingPeriodIds || [],
            hideEmptyCols
        );
        panel.appendChild(acctList);

        var quarterList = document.createElement('div');
        quarterList.id = 'kanban-filter-quarter-list';
        quarterList.className = 'kanban-filter-period-list';
        quarterList.style.display = 'none';
        appendPeriodCheckboxes(
            quarterList,
            'quarter',
            data.quarterPeriods || [],
            data.defaultQuarterPeriodIds || [],
            hideEmptyCols
        );
        panel.appendChild(quarterList);

        var rangeList = document.createElement('div');
        rangeList.id = 'kanban-filter-range-list';
        rangeList.className = 'kanban-filter-range-list';
        rangeList.style.display = 'none';

        var dateRangeLabel = document.createElement('span');
        dateRangeLabel.className = 'kanban-date-range-label';
        dateRangeLabel.textContent = 'From';

        var dateStart = document.createElement('input');
        dateStart.type = 'date';
        dateStart.id = 'kanban-date-start';
        dateStart.className = 'kanban-date-input';
        dateStart.setAttribute('aria-label', 'Close date from');
        dateStart.setAttribute('onchange', makeApplyFiltersTriggerOnclick());

        var dateToLabel = document.createElement('span');
        dateToLabel.className = 'kanban-date-range-label';
        dateToLabel.textContent = 'To';

        var dateEnd = document.createElement('input');
        dateEnd.type = 'date';
        dateEnd.id = 'kanban-date-end';
        dateEnd.className = 'kanban-date-input';
        dateEnd.setAttribute('aria-label', 'Close date to');
        dateEnd.setAttribute('onchange', makeApplyFiltersTriggerOnclick());

        rangeList.appendChild(dateRangeLabel);
        rangeList.appendChild(dateStart);
        rangeList.appendChild(dateToLabel);
        rangeList.appendChild(dateEnd);
        panel.appendChild(rangeList);

        wrap.appendChild(chipWrap);
        wrap.appendChild(panel);
        return wrap;
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
        card.setAttribute('data-close-date', normalizeCloseDateToIso(opp.expectedclosedate));
        card.setAttribute('data-amount', opp.projectedtotal || '0');
        card.setAttribute('data-status-type', classifyStatus(opp.entitystatusText));
        card.setAttribute(
            'data-search-text',
            ((opp.tranid || '') + ' ' + (opp.companyname || '')).toLowerCase()
        );
        if (opp.isInClosedPeriod) {
            card.setAttribute('data-period-locked', '1');
            card.className = 'kanban-card kanban-card-period-locked';
            card.setAttribute('title', 'Closed accounting period — cannot move on board');
        }

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
        prob.textContent = opp.probability != null ? String(opp.probability) : '';

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

        if (data.updateUrl && opp.id && !opp.isInClosedPeriod) {
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
            { id: 'kpi-count', label: 'Opportunities', initial: '0' },
            { id: 'kpi-open', label: 'Open Value', initial: '$0' },
            { id: 'kpi-won', label: 'Closed Won', initial: '$0' },
            { id: 'kpi-lost', label: 'Lost', initial: '$0' }
        ];

        kpis.forEach(function (kpi) {
            var card = document.createElement('div');
            card.className = 'kanban-kpi-item';

            var label = document.createElement('div');
            label.className = 'kanban-kpi-label';
            label.textContent = kpi.label;

            var value = document.createElement('div');
            value.className = 'kanban-kpi-value';
            value.id = kpi.id;
            value.textContent = kpi.initial;

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
        var oppCount = 0;
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].style.display === 'none') continue;
            oppCount++;
            var type = cards[i].getAttribute('data-status-type') || 'open';
            var amt = parseFloat(cards[i].getAttribute('data-amount')) || 0;
            if (sums.hasOwnProperty(type)) sums[type] += amt;
        }
        var countEl = document.getElementById('kpi-count');
        var openEl = document.getElementById('kpi-open');
        var wonEl = document.getElementById('kpi-won');
        var lostEl = document.getElementById('kpi-lost');
        if (countEl) countEl.textContent = formatCount(oppCount);
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

        filtersWrap.appendChild(createUnifiedFilterChip(hideEmptyCols));
        filtersWrap.appendChild(createSearchInput(hideEmptyCols));

        toolbar.appendChild(filtersWrap);
        toolbar.appendChild(createExpandButton());

        if (container.parentNode) {
            container.parentNode.insertBefore(createFilterApplyHook(hideEmptyCols), container);
        } else {
            container.appendChild(createFilterApplyHook(hideEmptyCols));
        }
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

        container.setAttribute(
            'data-default-acct-periods',
            (data.defaultAccountingPeriodIds || []).join(',')
        );
        container.setAttribute(
            'data-default-quarter-periods',
            (data.defaultQuarterPeriodIds || []).join(',')
        );
        container.setAttribute(
            'data-closed-ranges',
            encodeURIComponent(JSON.stringify(data.closedAccountingRanges || []))
        );
        container.setAttribute('onclick', makeClosePeriodPanelsOnclick());

        applyAllFilters();
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
