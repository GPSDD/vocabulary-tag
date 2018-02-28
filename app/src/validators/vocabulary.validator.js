
const logger = require('logger');
const VocabularyNotValid = require('errors/vocabulary-not-valid.error');

class VocabularyValidator {

    static async validate(ctx) {
        logger.info('Validating Vocabulary Creation');
        ctx.checkBody('name').notEmpty().toLow();
        if (ctx.errors) {
            logger.error('Error validating vocabulary creation');
            throw new VocabularyNotValid(ctx.errors);
        }
        return true;
    }

}

module.exports = VocabularyValidator;
