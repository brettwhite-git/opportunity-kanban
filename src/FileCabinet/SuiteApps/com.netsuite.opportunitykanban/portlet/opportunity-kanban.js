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

            const kanbanData = {
                columns: statusColumns,
                opportunities: opportunities,
                userId: userId,
                selectedStatusIds: selectedStatusIds,
                allowedStatusIds: selectedStatusIds,
                updateUrl: updateUrl
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
    gap: 4px;
    flex-wrap: wrap;
    min-width: 0;
}

.kanban-filter-chip {
    padding: 4px 14px;
    border: 1px solid rgba(22, 21, 19, 0.2);
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: #161513;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    display: inline-flex;
    align-items: center;
    user-select: none;
    -webkit-user-select: none;
    line-height: 1.4;
    white-space: nowrap;
}

.kanban-filter-chip:hover {
    background: #f5f4f2;
    border-color: rgba(22, 21, 19, 0.35);
}

.kanban-filter-chip:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

.kanban-filter-chip.active {
    background: #325c72;
    color: #fff;
    border-color: #325c72;
}

.kanban-date-range {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 4px;
}

.kanban-date-input {
    padding: 3px 6px;
    border: 1px solid rgba(22, 21, 19, 0.2);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    color: #161513;
    max-width: 130px;
}

.kanban-date-input:focus {
    outline: 2px solid #325c72;
    outline-offset: 1px;
}

.kanban-filter-apply {
    padding: 4px 10px;
    border: 1px solid #325c72;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: #325c72;
    cursor: pointer;
    line-height: 1.4;
    user-select: none;
    -webkit-user-select: none;
}

.kanban-filter-apply:hover {
    background: #f0f4f6;
}

.kanban-filter-apply:focus {
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
