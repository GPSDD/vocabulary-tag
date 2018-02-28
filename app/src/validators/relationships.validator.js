
const logger = require('logger');
const RelationshipsNotValid = require('errors/relationships-not-valid.error');

class RelationshipsValidator {

    static async validate(ctx) {
        logger.info('Validating Relationships Creation');
        Object.keys(ctx.request.body).forEach(function (key) {
            if (key !== 'loggedUser') {
                ctx.checkBody(key).check(function () {
                    if (this[key] instanceof Object && this[key].length === undefined) {
                        const matchTags = this[key].tags instanceof Array && this[key].tags.length > 0;
                        if (matchTags) {
                            return true;
                        }
                        return false;
                    }
                    return false;
                }.bind(ctx.request.body));
            }
        }.bind(ctx.request.body));
        if (ctx.errors) {
            logger.error('Error validating relationships creation');
            throw new RelationshipsNotValid(ctx.errors);
        }
        return true;
    }

}

module.exports = RelationshipsValidator;
