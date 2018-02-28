const logger = require('logger');
const ErrorSerializer = require('serializers/error.serializer');
const CollectionModel = require('models/collection.model');

class CollectionValidator {

    static getUser(ctx) {
        return JSON.parse(ctx.headers.user_key) ? JSON.parse(ctx.headers.user_key) : { id: null };
    }

    static getApplication(ctx) {
        return JSON.parse(ctx.headers.app_key).application;
    }

    static async validate(ctx) {
        logger.info('Validating Collection Creation');
        ctx.checkBody('name').notEmpty();
        ctx.checkBody('resources').optional().check((data) => {
            logger.debug('entering validation', data.resources);
            if (data.resources) {
                for (let i = 0; i < data.resources.length; i++) {
                    if (!data.rsources[i].type || !data.resources[i].id) { return false; }
                }
            }
            return true;
        });

        if (ctx.errors) {
            logger.debug('errors ', ctx.errors);
            ctx.body = ErrorSerializer.serializeValidationBodyErrors(ctx.errors);
            ctx.status = 400;
            return;
        }

        // App validation
        const user = CollectionValidator.getUser(ctx);
        const application = CollectionValidator.getApplication(ctx);
        if (user.extraUserData.apps.indexOf(application) === -1) {
            ctx.throw(403, 'Forbidden');
            return;
        }

        const data = await CollectionModel.findOne({
            name: ctx.request.body.name,
            application,
            ownerId: ctx.request.body.loggedUser.id,
        });
        if (data) {
            ctx.throw(400, 'Collection duplicated!');
        }
    }

}

module.exports = CollectionValidator;
