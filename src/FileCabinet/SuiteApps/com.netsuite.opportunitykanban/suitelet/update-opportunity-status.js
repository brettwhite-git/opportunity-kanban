/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime'], (record, runtime) => {

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
                    entitystatusText: opp.getText({ fieldId: 'entitystatus' })
                });
                return;
            }

            record.submitFields({
                type: record.Type.OPPORTUNITY,
                id: opportunityId,
                values: { entitystatus }
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
                probability: updated.getValue({ fieldId: 'probability' })
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
