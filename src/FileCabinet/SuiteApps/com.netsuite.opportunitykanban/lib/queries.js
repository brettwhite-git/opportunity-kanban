/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(['N/search'], (search) => {

    /**
     * Derives unique status columns from an array of opportunities.
     * Only returns statuses that have actual opportunities — no empty columns.
     *
     * @param {Array<Object>} opportunities - Array from getOpportunitiesByUser()
     * @returns {Array<{id: string, name: string}>}
     */
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
     * @returns {Array<Object>} Array of opportunity objects
     */
    const getOpportunitiesByUser = (userId) => {
        const opportunities = [];

        const oppSearch = search.create({
            type: search.Type.OPPORTUNITY,
            filters: [
                ['salesrep', 'anyof', userId]
            ],
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

        log.debug({ title: 'getOpportunitiesByUser', details: `Found ${opportunities.length} opportunities for user ${userId}` });
        return opportunities;
    };

    return { deriveStatusColumns, getOpportunitiesByUser };
});
