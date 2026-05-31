/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/file', 'N/url', '../lib/queries'], (runtime, file, url, queries) => {

    const render = (params) => {
        const portletObject = params.portlet;
        portletObject.title = 'Opportunity Kanban';

        try {
            const currentUser = runtime.getCurrentUser();
            const userId = currentUser.id;
            const selectedStatusIds = queries.normalizeStatusIds(
                runtime.getCurrentScript().getParameter({
                    name: 'custscript_opp_kanban_status_ids'
                })
            );

            const opportunities = queries.getOpportunitiesByUser(userId, selectedStatusIds);
            const statusColumns = queries.buildStatusColumns(selectedStatusIds, opportunities);
            const updateUrl = url.resolveScript({
                scriptId: 'customscript_opp_kanban_update',
                deploymentId: 'customdeploy_opp_kanban_update',
                returnExternalUrl: false
            });

            let periodFilters;
            try {
                periodFilters = queries.getCloseDatePeriodFilters();
            } catch (periodErr) {
                log.audit({
                    title: 'OpportunityKanban.periodFilters',
                    details: periodErr.message || periodErr
                });
                periodFilters = queries.emptyCloseDatePeriodFilters();
            }
            queries.markOpportunitiesInClosedPeriods(
                opportunities,
                periodFilters.closedAccountingRanges
            );

            const kanbanData = {
                columns: statusColumns,
                opportunities: opportunities,
                userId: userId,
                selectedStatusIds: selectedStatusIds,
                allowedStatusIds: selectedStatusIds,
                updateUrl: updateUrl,
                accountingPeriods: periodFilters.accountingPeriods,
                quarterPeriods: periodFilters.quarterPeriods,
                defaultAccountingPeriodIds: periodFilters.defaultAccountingPeriodIds,
                defaultQuarterPeriodIds: periodFilters.defaultQuarterPeriodIds,
                defaultRangeStartIso: periodFilters.defaultRangeStartIso,
                defaultRangeEndIso: periodFilters.defaultRangeEndIso,
                closedAccountingRanges: periodFilters.closedAccountingRanges
            };

            const clientFile = file.load({
                id: '/SuiteApps/com.netsuite.opportunitykanban/portlet/kanban-client.js'
            });
            const clientUrl = clientFile.url;

            portletObject.html = buildHtml(kanbanData, clientUrl);
        } catch (e) {
            log.error({ title: 'OpportunityKanban.render', details: e.message || e });
            portletObject.html = '<div style="padding:20px;color:#c00;">Error loading kanban board. Check script logs.</div>';
        }
    };

    const buildHtml = (kanbanData, clientUrl) => {
        const styles = buildStyles();
        const safeData = JSON.stringify(kanbanData).replace(/<\//g, '<\\/');
        const cacheBust = Date.now();

        return [
            '<style>' + styles + '</style>',
            '<div id="kanban-board-container">',
            '<div id="kanban-loading" style="padding:40px;text-align:center;color:#888;">Loading board...</div>',
            '</div>',
            '<script>window.KANBAN_DATA = ' + safeData + ';</script>',
            '<script src="' + clientUrl + '&_cb=' + cacheBust + '"></script>'
        ].join('\n');
    };

    const buildStyles = () => {
        return `
#kanban-board-container {
    font-family: "Oracle Sans", "Helvetica Neue", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #333;
    position: relative;
}

.kanban-board-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(22, 21, 19, 0.28);
    pointer-events: auto;
}

.kanban-expand-btn {
    padding: 4px 12px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: #555;
    cursor: pointer;
    line-height: 1.4;
    user-select: none;
    -webkit-user-select: none;
    flex-shrink: 0;
}

.kanban-expand-btn:hover {
    background: #f0f0f0;
    border-color: #999;
}

.kanban-expand-btn:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

#kanban-board-container.kanban-board-expanded {
    position: fixed;
    top: 28px;
    right: 28px;
    bottom: 28px;
    left: 28px;
    z-index: 100000;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(22, 21, 19, 0.22);
    overflow: auto;
    padding: 16px 20px 24px;
    box-sizing: border-box;
}

#kanban-board-container.kanban-board-expanded .kanban-columns {
    min-height: calc(100vh - 260px);
    max-height: none;
}

#kanban-board-container.kanban-board-expanded .kanban-column {
    max-height: calc(100vh - 280px);
    flex: 0 0 260px;
}

.kanban-toolbar {
    padding: 8px 0;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.kanban-toolbar-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    min-width: 0;
    flex: 1 1 auto;
}

.kanban-period-dropdown {
    position: relative;
    display: inline-block;
}

.kanban-filter-chip-wrap {
    display: inline-flex;
    align-items: stretch;
    max-width: 280px;
}

.kanban-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 4px 8px 4px 12px;
    border: 1px solid #ccc;
    border-radius: 3px 0 0 3px;
    border-right: none;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: #555;
    cursor: pointer;
    line-height: 1.4;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.kanban-filter-chip:hover {
    background: #f0f0f0;
    border-color: #999;
}

.kanban-filter-chip:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

.kanban-filter-chip.active {
    background: #325c72;
    border-color: #325c72;
    color: #fff;
}

.kanban-filter-chip.active:hover {
    background: #2a4f61;
    border-color: #2a4f61;
}

.kanban-filter-chip-label {
    flex-shrink: 0;
}

.kanban-filter-chip-sep {
    margin: 0 8px;
    padding-left: 8px;
    border-left: 1px solid rgba(22, 21, 19, 0.2);
    flex-shrink: 0;
}

.kanban-filter-chip.active .kanban-filter-chip-sep {
    border-left-color: rgba(255, 255, 255, 0.45);
}

.kanban-filter-chip-value {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
}

.kanban-filter-chip-clear {
    display: none;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    border: 1px solid #ccc;
    border-left: none;
    border-radius: 0 3px 3px 0;
    font-size: 14px;
    line-height: 1;
    font-weight: 600;
    background: #fff;
    color: #555;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    flex-shrink: 0;
}

.kanban-filter-chip-wrap.has-clear .kanban-filter-chip {
    border-radius: 3px 0 0 3px;
}

.kanban-filter-chip-wrap.has-clear .kanban-filter-chip-clear {
    display: inline-flex;
}

.kanban-filter-chip-wrap.has-clear.active .kanban-filter-chip-clear {
    background: #325c72;
    border-color: #325c72;
    color: #fff;
}

.kanban-filter-chip-wrap.has-clear.active .kanban-filter-chip-clear:hover {
    background: #2a4f61;
    border-color: #2a4f61;
}

.kanban-filter-chip-wrap:not(.has-clear) .kanban-filter-chip {
    border-right: 1px solid #ccc;
    border-radius: 3px;
}

.kanban-filter-chip-wrap:not(.has-clear) .kanban-filter-chip.active {
    border-right-color: #325c72;
}

.kanban-period-panel,
.kanban-filter-panel {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100001;
    min-width: 260px;
    max-height: 320px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid rgba(22, 21, 19, 0.2);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(22, 21, 19, 0.15);
    padding: 0;
}

.kanban-filter-mode-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(22, 21, 19, 0.12);
    padding: 8px 8px 0;
}

.kanban-filter-mode-btn {
    flex: 1;
    text-align: center;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #555;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    user-select: none;
    -webkit-user-select: none;
}

.kanban-filter-mode-btn:hover {
    background: #f5f4f2;
    color: #161513;
}

.kanban-filter-mode-btn.active {
    background: #eef3f6;
    color: #325c72;
    box-shadow: inset 0 -2px 0 #325c72;
}

.kanban-filter-period-list {
    padding: 4px 0;
    max-height: 160px;
    overflow-y: auto;
}

.kanban-filter-range-list {
    display: none;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    padding: 8px 12px 10px;
}

.kanban-search-input {
    padding: 4px 8px;
    border: 1px solid rgba(22, 21, 19, 0.2);
    border-radius: 3px;
    font-size: 12px;
    font-family: inherit;
    color: #161513;
    min-width: 100px;
    width: 160px;
    flex: 1 1 160px;
    max-width: 220px;
}

.kanban-search-input:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

.kanban-search-input::placeholder {
    color: #888;
}

.kanban-period-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 12px;
    color: #161513;
    cursor: pointer;
    white-space: nowrap;
}

.kanban-period-option:hover {
    background: #f5f4f2;
}

.kanban-period-option input {
    margin: 0;
    cursor: pointer;
}

.kanban-date-range-label {
    font-size: 12px;
    font-weight: 600;
    color: #555;
    white-space: nowrap;
}

.kanban-date-input {
    padding: 3px 6px;
    border: 1px solid rgba(22, 21, 19, 0.2);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    color: #161513;
    min-width: 0;
    flex: 1 1 100px;
    max-width: 118px;
}

.kanban-card-period-locked {
    opacity: 0.72;
    cursor: not-allowed;
}

.kanban-card-period-locked .kanban-card-tranid {
    cursor: pointer;
}

.kanban-date-input:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

.kanban-columns {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
    min-height: 300px;
}

.kanban-column {
    flex: 0 0 220px;
    background: #fbf9f8;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    max-height: 500px;
}

.kanban-column-header {
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border-bottom: 2px solid #ddd;
    min-width: 0;
}

.kanban-column-title {
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kanban-column-count {
    background: #ddd;
    color: #666;
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
}

.kanban-column-body {
    padding: 8px;
    overflow-y: auto;
    flex: 1;
}

.kanban-card {
    background: #fff;
    border-radius: 4px;
    padding: 10px;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    cursor: pointer;
    transition: box-shadow 0.15s ease;
    border-left: 3px solid #325c72;
}

.kanban-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.kanban-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.kanban-card-tranid {
    font-weight: 600;
    font-size: 12px;
    color: #0066cc;
    text-decoration: none;
}

.kanban-card-tranid:hover {
    text-decoration: underline;
}

.kanban-card-probability {
    font-size: 11px;
    color: #888;
    font-weight: 600;
}

.kanban-card-company {
    font-size: 13px;
    color: #333;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kanban-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.kanban-card-date {
    font-size: 11px;
    color: #888;
}

.kanban-card-amount {
    font-size: 12px;
    font-weight: 700;
    color: #2e7d32;
}

#kanban-loading {
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 14px;
}

.kanban-empty {
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 14px;
}

.kanban-kpi-row {
    display: flex;
    align-items: stretch;
    margin: 0 0 16px;
    font-family: "Oracle Sans", "Helvetica Neue", sans-serif;
}

.kanban-kpi-item {
    flex: 1;
    padding: 8px 16px;
    border-right: 1px solid #d3d3d3;
    box-sizing: border-box;
    min-width: 0;
}

.kanban-kpi-item:last-child {
    border-right: none;
}

.kanban-kpi-label {
    font-size: 16px;
    font-weight: 400;
    color: rgb(0, 0, 0);
    margin: 0 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
}


.kanban-card[draggable="true"] {
    cursor: grab;
}

.kanban-card.kanban-card-dragging {
    opacity: 0.55;
    cursor: grabbing;
}

.kanban-column-body.kanban-drop-hover {
    background: rgba(50, 92, 114, 0.08);
    outline: 2px dashed #325c72;
    outline-offset: -2px;
}

.kanban-kpi-value {
    font-size: 16px;
    font-weight: 700;
    color: rgb(0, 0, 0);
    display: flex;
    align-items: center;
}`;
    };

    return { render };
});
