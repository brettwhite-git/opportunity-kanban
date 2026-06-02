/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', '../lib/queries'], (record, runtime, queries) => {

    const writeJson = (response, payload) => {
        response.setHeader({ name: 'Content-Type', value: 'application/json' });
        response.write({ output: JSON.stringify(payload) });
    };

    const parseBody = (request) => {
        const raw = request.body;
        if (!raw) {
            return {};
        }
        if (typeof raw === 'object') {
            return raw;
        }
        return JSON.parse(String(raw));
    };

    const isNumericId = (value) => /^\d+$/.test(String(value || '').trim());

    const readProbabilityDisplay = (rec) => {
        const text = rec.getText({ fieldId: 'probability' });
        return text != null ? String(text) : '';
    };

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

    const onRequest = (context) => {
        const { request, response } = context;

        if (request.method !== 'POST') {
            writeJson(response, { ok: false, error: 'Method not allowed' });
            return;
        }

        try {
            const body = parseBody(request);
            const opportunityId = String(body.opportunityId || '').trim();
            const entitystatus = String(body.entitystatus || '').trim();
            const fromStatusId = body.fromStatusId != null ? String(body.fromStatusId).trim() : '';

            if (!isNumericId(opportunityId) || !isNumericId(entitystatus)) {
                writeJson(response, { ok: false, error: 'Invalid opportunity or status id' });
                return;
            }

            if (fromStatusId && !isNumericId(fromStatusId)) {
                writeJson(response, { ok: false, error: 'Invalid from status id' });
                return;
            }

            const currentUserId = runtime.getCurrentUser().id;
            const opp = record.load({
                type: record.Type.OPPORTUNITY,
                id: opportunityId,
                isDynamic: true
            });

            const salesRepId = opp.getValue({ fieldId: 'salesrep' });
            if (String(salesRepId) !== String(currentUserId)) {
                writeJson(response, { ok: false, error: 'You may only update your own opportunities' });
                return;
            }

            const closeIso = toIsoDate(opp.getValue({ fieldId: 'expectedclosedate' }));
            const closedRanges = queries.parseClosedAccountingRanges(body.closedAccountingRanges);
            if (queries.isCloseDateInClosedPeriod(closeIso, closedRanges)) {
                writeJson(response, {
                    ok: false,
                    error: 'This opportunity is in a closed accounting period and cannot be updated.'
                });
                return;
            }

            const currentStatusId = String(opp.getValue({ fieldId: 'entitystatus' }) || '');
            if (fromStatusId && currentStatusId !== fromStatusId) {
                writeJson(response, {
                    ok: false,
                    error: 'Opportunity status changed. Refresh the board and try again.'
                });
                return;
            }

            if (currentStatusId === entitystatus) {
                writeJson(response, {
                    ok: true,
                    entitystatus,
                    entitystatusText: opp.getText({ fieldId: 'entitystatus' }),
                    probability: readProbabilityDisplay(opp)
                });
                return;
            }

            record.submitFields({
                type: record.Type.OPPORTUNITY,
                id: opportunityId,
                values: { entitystatus },
                options: {
                    enableSourcing: true
                }
            });

            const updated = record.load({
                type: record.Type.OPPORTUNITY,
                id: opportunityId,
                isDynamic: true
            });

            writeJson(response, {
                ok: true,
                entitystatus,
                entitystatusText: updated.getText({ fieldId: 'entitystatus' }),
                probability: readProbabilityDisplay(updated)
            });
        } catch (e) {
            log.error({
                title: 'UpdateOpportunityStatus',
                details: e.message || e
            });
            writeJson(response, {
                ok: false,
                error: e.message || 'Unable to update opportunity status'
            });
        }
    };

    return { onRequest };
});
