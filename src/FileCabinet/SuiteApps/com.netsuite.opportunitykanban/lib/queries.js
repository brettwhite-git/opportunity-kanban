/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/search'], (search) => {

    /**
     * Normalizes an admin-entered status filter into valid NetSuite internal IDs.
     *
     * @param {string|Array<string|number>} value - Comma/whitespace-separated IDs or array of IDs
     * @returns {Array<string>} Numeric internal IDs as strings
     */
    const normalizeStatusIds = (value) => {
        const parts = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
        const seen = {};
        const statusIds = [];

        parts.forEach((part) => {
            const statusId = String(part || '').trim();
            if (/^\d+$/.test(statusId) && !seen[statusId]) {
                seen[statusId] = true;
                statusIds.push(statusId);
            }
        });

        return statusIds;
    };

    /**
     * Derives unique status columns from an array of opportunities.
     * Only returns statuses that have actual opportunities — no empty columns.
     *
     * @param {Array<Object>} opportunities - Array from getOpportunitiesByUser()
     * @returns {Array<{id: string, name: string}>}
     */

    /**
     * Builds kanban columns from deployment status IDs when configured; otherwise
     * derives columns from opportunities that have data.
     *
     * @param {Array<string>} statusIds - Normalized status internal IDs from script param
     * @param {Array<Object>} opportunities - Array from getOpportunitiesByUser()
     * @returns {Array<{id: string, name: string}>}
     */
    const buildStatusColumns = (statusIds, opportunities) => {
        if (!statusIds || statusIds.length === 0) {
            return deriveStatusColumns(opportunities);
        }

        const nameById = {};
        opportunities.forEach((opp) => {
            const statusId = String(opp.entitystatus || '');
            if (statusId && opp.entitystatusText) {
                nameById[statusId] = opp.entitystatusText;
            }
        });

        const sortedIds = statusIds.slice().sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        return sortedIds.map((statusId) => ({
            id: statusId,
            name: nameById[statusId] || ('Status ' + statusId)
        }));
    };

    const deriveStatusColumns = (opportunities) => {
        const seen = {};
        const columns = [];

        opportunities.forEach((opp) => {
            const statusId = opp.entitystatus;
            if (statusId && !seen[statusId]) {
                seen[statusId] = true;
                columns.push({
                    id: statusId,
                    name: opp.entitystatusText || ('Status ' + statusId)
                });
            }
        });

        columns.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
        log.debug({ title: 'deriveStatusColumns', details: `Found ${columns.length} status columns` });
        return columns;
    };

    /**
     * Fetches all opportunities assigned to a given sales rep.
     *
     * @param {number|string} userId - Internal ID of the sales rep
     * @param {Array<string|number>} [statusIds] - Optional Opportunity status internal IDs
     * @returns {Array<Object>} Array of opportunity objects
     */
    const getOpportunitiesByUser = (userId, statusIds) => {
        const opportunities = [];
        const normalizedStatusIds = normalizeStatusIds(statusIds);
        const filters = [
            ['salesrep', 'anyof', userId]
        ];

        if (normalizedStatusIds.length > 0) {
            filters.push('AND', ['entitystatus', 'anyof', normalizedStatusIds]);
        }

        const oppSearch = search.create({
            type: search.Type.OPPORTUNITY,
            filters: filters,
            columns: [
                search.createColumn({ name: 'tranid' }),
                search.createColumn({ name: 'entity' }),
                search.createColumn({ name: 'entitystatus' }),
                search.createColumn({ name: 'probability' }),
                search.createColumn({ name: 'expectedclosedate' }),
                search.createColumn({ name: 'projectedtotal' }),
                search.createColumn({ name: 'title' }),
                search.createColumn({
                    name: 'formulatext',
                    formula: "TRIM(CASE WHEN {expectedclosedate} >= ADD_MONTHS(TRUNC(SYSDATE,'Q'),-3) AND {expectedclosedate} < TRUNC(SYSDATE,'Q') THEN 'LAST_QUARTER ' ELSE '' END || CASE WHEN {expectedclosedate} >= TRUNC(SYSDATE,'MM') AND {expectedclosedate} < ADD_MONTHS(TRUNC(SYSDATE,'MM'),1) THEN 'THIS_MONTH ' ELSE '' END || CASE WHEN {expectedclosedate} >= TRUNC(SYSDATE,'Q') AND {expectedclosedate} < ADD_MONTHS(TRUNC(SYSDATE,'Q'),3) THEN 'THIS_QUARTER ' ELSE '' END || CASE WHEN {expectedclosedate} >= ADD_MONTHS(TRUNC(SYSDATE,'Q'),3) AND {expectedclosedate} < ADD_MONTHS(TRUNC(SYSDATE,'Q'),6) THEN 'NEXT_QUARTER ' ELSE '' END)"
                })
            ]
        });

        oppSearch.run().each((result) => {
            opportunities.push({
                id: String(result.id),
                tranid: result.getValue({ name: 'tranid' }),
                companyname: result.getText({ name: 'entity' }),
                entitystatus: result.getValue({ name: 'entitystatus' }),
                entitystatusText: result.getText({ name: 'entitystatus' }),
                probability: result.getValue({ name: 'probability' }),
                expectedclosedate: result.getValue({ name: 'expectedclosedate' }),
                closeDateGroup: result.getValue({ name: 'formulatext' }) || 'OTHER',
                projectedtotal: result.getValue({ name: 'projectedtotal' }),
                title: result.getValue({ name: 'title' })
            });
            return true;
        });

        log.debug({
            title: 'getOpportunitiesByUser',
            details: `Found ${opportunities.length} opportunities for user ${userId}`
        });
        return opportunities;
    };

    /**
     * Normalizes NetSuite date values to ISO YYYY-MM-DD.
     *
     * @param {Date|string} value - Field value from search
     * @returns {string}
     */
    const toIsoDate = (value) => {
        if (!value) return '';
        if (value instanceof Date && !isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = value.getMonth() + 1;
            const d = value.getDate();
            const mm = m < 10 ? '0' + m : String(m);
            const dd = d < 10 ? '0' + d : String(d);
            return y + '-' + mm + '-' + dd;
        }
        const str = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const parts = str.split('/');
        if (parts.length !== 3) return '';
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (!month || !day || !year) return '';
        const mm = month < 10 ? '0' + month : String(month);
        const dd = day < 10 ? '0' + day : String(day);
        return year + '-' + mm + '-' + dd;
    };

    const isTruthy = (value) => value === true || value === 'T';

    /**
     * @param {string} closeIso - YYYY-MM-DD
     * @param {Array<{startIso: string, endIso: string}>} closedRanges
     * @returns {boolean}
     */
    const isCloseDateInClosedPeriod = (closeIso, closedRanges) => {
        if (!closeIso || !closedRanges || !closedRanges.length) return false;
        for (let i = 0; i < closedRanges.length; i++) {
            const range = closedRanges[i];
            if (range.startIso <= closeIso && closeIso <= range.endIso) return true;
        }
        return false;
    };

    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    /**
     * Validates closed-period ranges supplied by the client (from KANBAN_DATA at board load).
     * Avoids an accounting-period search on every drag-and-drop save.
     *
     * @param {*} raw - Request body closedAccountingRanges
     * @returns {Array<{startIso: string, endIso: string}>}
     */
    const parseClosedAccountingRanges = (raw) => {
        if (!Array.isArray(raw)) return [];
        const ranges = [];
        raw.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const startIso = String(item.startIso || '').trim();
            const endIso = String(item.endIso || '').trim();
            if (!ISO_DATE_RE.test(startIso) || !ISO_DATE_RE.test(endIso)) return;
            if (startIso > endIso) return;
            ranges.push({ startIso, endIso });
        });
        return ranges;
    };

    const emptyCloseDatePeriodFilters = () => ({
        accountingPeriods: [],
        quarterPeriods: [],
        defaultAccountingPeriodIds: [],
        defaultQuarterPeriodIds: [],
        defaultRangeStartIso: '',
        defaultRangeEndIso: '',
        closedAccountingRanges: []
    });

    /**
     * @param {Array<Object>} opportunities
     * @param {Array<{startIso: string, endIso: string}>} closedRanges
     * @returns {Array<Object>}
     */
    const markOpportunitiesInClosedPeriods = (opportunities, closedRanges) => {
        (opportunities || []).forEach((opp) => {
            const closeIso = toIsoDate(opp.expectedclosedate);
            opp.isInClosedPeriod = isCloseDateInClosedPeriod(closeIso, closedRanges);
        });
        return opportunities;
    };

    /**
     * Loads accounting periods for close-date filtering (month + quarter lists).
     *
     * @returns {{
     *   accountingPeriods: Array<{id: string, name: string, startIso: string, endIso: string, closed: boolean}>,
     *   quarterPeriods: Array<{id: string, name: string, startIso: string, endIso: string}>,
     *   defaultAccountingPeriodIds: Array<string>,
     *   defaultQuarterPeriodIds: Array<string>,
     *   defaultRangeStartIso: string,
     *   defaultRangeEndIso: string,
     *   closedAccountingRanges: Array<{startIso: string, endIso: string}>
     * }}
     */
    const getCloseDatePeriodFilters = () => {
        const accountingPeriods = [];
        const quarterPeriods = [];
        const todayIso = toIsoDate(new Date());

        search.create({
            type: search.Type.ACCOUNTING_PERIOD,
            filters: [['isinactive', 'is', 'F']],
            columns: [
                search.createColumn({ name: 'periodname' }),
                search.createColumn({ name: 'startdate', sort: search.Sort.ASC }),
                search.createColumn({ name: 'enddate' }),
                search.createColumn({ name: 'isquarter' }),
                search.createColumn({ name: 'isyear' }),
                search.createColumn({ name: 'closed' })
            ]
        }).run().each((result) => {
            const isYear = isTruthy(result.getValue({ name: 'isyear' }));
            const isQuarter = isTruthy(result.getValue({ name: 'isquarter' }));
            if (isYear) return true;

            const startIso = toIsoDate(result.getValue({ name: 'startdate' }));
            const endIso = toIsoDate(result.getValue({ name: 'enddate' }));
            if (!startIso || !endIso) return true;

            const period = {
                id: String(result.id),
                name: result.getValue({ name: 'periodname' }) || ('Period ' + result.id),
                startIso: startIso,
                endIso: endIso
            };

            if (isQuarter) {
                quarterPeriods.push(period);
            } else {
                period.closed = isTruthy(result.getValue({ name: 'closed' }));
                accountingPeriods.push(period);
            }
            return true;
        });

        const defaultAccountingPeriodIds = accountingPeriods
            .filter((p) => todayIso >= p.startIso && todayIso <= p.endIso)
            .map((p) => p.id);
        const defaultQuarterPeriodIds = quarterPeriods
            .filter((p) => todayIso >= p.startIso && todayIso <= p.endIso)
            .map((p) => p.id);

        if (defaultAccountingPeriodIds.length === 0 && accountingPeriods.length > 0) {
            defaultAccountingPeriodIds.push(accountingPeriods[accountingPeriods.length - 1].id);
        }
        if (defaultQuarterPeriodIds.length === 0 && quarterPeriods.length > 0) {
            defaultQuarterPeriodIds.push(quarterPeriods[quarterPeriods.length - 1].id);
        }

        const closedAccountingRanges = accountingPeriods
            .filter((p) => p.closed)
            .map((p) => ({ startIso: p.startIso, endIso: p.endIso }));

        let defaultRangeStartIso = '';
        let defaultRangeEndIso = '';
        defaultAccountingPeriodIds.forEach((periodId) => {
            const match = accountingPeriods.find((p) => p.id === periodId);
            if (!match) return;
            if (!defaultRangeStartIso || match.startIso < defaultRangeStartIso) {
                defaultRangeStartIso = match.startIso;
            }
            if (!defaultRangeEndIso || match.endIso > defaultRangeEndIso) {
                defaultRangeEndIso = match.endIso;
            }
        });

        return {
            accountingPeriods,
            quarterPeriods,
            defaultAccountingPeriodIds,
            defaultQuarterPeriodIds,
            defaultRangeStartIso,
            defaultRangeEndIso,
            closedAccountingRanges
        };
    };

    return {
        buildStatusColumns,
        deriveStatusColumns,
        emptyCloseDatePeriodFilters,
        getCloseDatePeriodFilters,
        getOpportunitiesByUser,
        isCloseDateInClosedPeriod,
        markOpportunitiesInClosedPeriods,
        normalizeStatusIds,
        parseClosedAccountingRanges
    };
});
