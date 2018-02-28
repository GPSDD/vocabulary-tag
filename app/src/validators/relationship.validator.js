
const logger = require('logger');
const RelationshipNotValid = require('errors/relationship-not-valid.error');

class RelationshipValidator {

    static async validate(ctx) {
        logger.info('Validating Relationship Creation');
        ctx.checkBody('tags').notEmpty().check(function () {
            const matchTags = this.tags instanceof Array && this.tags.length > 0;
            if (matchTags) {
                return true;
            }
            return false;
        }.bind(ctx.request.body));
        if (ctx.errors) {
            logger.error('Error validating relationship creation');
            throw new RelationshipNotValid(ctx.errors);
        }
        return true;
    }

}

module.exports = RelationshipValidator;
