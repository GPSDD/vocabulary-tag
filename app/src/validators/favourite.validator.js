const logger = require('logger');
const ErrorSerializer = require('serializers/error.serializer');
const FavouriteModel = require('models/favourite.model');
const RESOURCES = require('app.constants').RESOURCES;

class FavouriteValidator {

    static getUser(ctx) {
        return JSON.parse(ctx.headers.user_key) ? JSON.parse(ctx.headers.user_key) : { id: null };
    }

    static getApplication(ctx) {
        return JSON.parse(ctx.headers.app_key).application;
    }

    static async validate(ctx) {
        logger.info('Validating Favourite Creation');
        ctx.checkBody('resourceType').notEmpty().in(RESOURCES);
        ctx.checkBody('resourceId').notEmpty();
        if (ctx.errors) {
            logger.debug('errors ', ctx.errors);
            ctx.body = ErrorSerializer.serializeValidationBodyErrors(ctx.errors);
            ctx.status = 400;
            return;
        }

        // App validation
        const user = FavouriteValidator.getUser(ctx);
        const application = FavouriteValidator.getApplication(ctx);
        if (user.extraUserData.apps.indexOf(application) === -1) {
            ctx.throw(403, 'Forbidden');
            return;
        }

        const data = await FavouriteModel.findOne({
            resourceType: ctx.request.body.resourceType,
            resourceId: ctx.request.body.resourceId,
            userId: ctx.request.body.loggedUser.id,
            application
        });
        if (data) {
            ctx.throw(400, 'Favourite duplicated');
        }
    }

}

module.exports = FavouriteValidator;
