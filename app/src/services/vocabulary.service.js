
const logger = require('logger');
const Vocabulary = require('models/vocabulary.model');
const VocabularyDuplicated = require('errors/vocabulary-duplicated.error');

class VocabularyService {

    static getQuery(query) {
        Object.keys(query).forEach((key) => {
            if (key === 'loggedUser' || key === 'app' || key === 'application' || query[key] === '' || query[key] === null || query[key] === undefined) {
                delete query[key];
            }
        });
        return query;
    }

    static async get(application, resource, pQuery) {
        logger.debug(`Getting resources by vocabulary-tag`);
        const query = VocabularyService.getQuery(pQuery);
        let vocabularies = Object.keys(query).map((vocabularyName) => {
            return Vocabulary.aggregate([
                { $match: {
                    id: vocabularyName,
                    application: application || { $ne: null },
                    'resources.type': resource.type,
                    'resources.tags': { $in: query[vocabularyName].split(',').map(elem => elem.trim()) }
                } },

                { $unwind: '$resources' },
                { $unwind: '$resources.tags' },

                { $match: {
                    'resources.type': resource.type,
                    'resources.tags': { $in: query[vocabularyName].split(',').map(elem => elem.trim()) }
                } },

                { $group: {
                    _id: 0,
                    resources: { $push: '$resources' }
                } }
            ]).exec();
        });
        vocabularies = (await Promise.all(vocabularies)); // [array of promises]
        if (!vocabularies || vocabularies.length === 0 || vocabularies[0].length === 0) {
            return null;
        }
        // just one vocabulary mathching? force to at least 2 arrays
        const validVocabularies = [];
        vocabularies.forEach((vocabulary) => {
            if (vocabulary.length !== 0) {
                validVocabularies.push(vocabulary);
            }
        });
        vocabularies = validVocabularies;
        if (vocabularies.length === 1) {
            vocabularies.push(vocabularies[0]);
        }
        vocabularies = vocabularies.reduce((a, b) => {
            return a.concat(b).reduce((a, b) => {
                // Unique a.resources
                const aUniqueResources = [];
                a.resources.forEach((nextResource) => {
                    const alreadyIn = aUniqueResources.find((currentResource) => {
                        return (nextResource.type === currentResource.type) && (nextResource.id === currentResource.id) && (nextResource.dataset === currentResource.dataset);
                    });
                    if (!alreadyIn) {
                        aUniqueResources.push(nextResource);
                    }
                });
                a.resources = aUniqueResources;
                // B in a unique resorces
                b.resources.forEach((nextResource) => {
                    const alreadyIn = a.resources.find((currentResource) => {
                        return (nextResource.type === currentResource.type) && (nextResource.id === currentResource.id) && (nextResource.dataset === currentResource.dataset);
                    });
                    if (!alreadyIn) {
                        a.resources.push(nextResource);
                    }
                });
                return a;
            });
        });
        // deleting tags from resource
        vocabularies.resources = vocabularies.resources.map((resource) => {
            delete resource.tags;
            return resource;
        });
        const limit = (isNaN(parseInt(query.limit, 10))) ? 0 : parseInt(query.limit, 10);
        if (limit > 0) {
            return vocabularies.slice(0, limit - 1);
        }
        return vocabularies;
    }

    static async create(application, user, pVocabulary) {
        logger.debug('Checking if vocabulary already exists');
        let vocabulary = await Vocabulary.findOne({
            id: pVocabulary.name,
            application
        }).exec();
        if (vocabulary) {
            logger.error('Error creating vocabulary');
            throw new VocabularyDuplicated(`Vocabulary of with name: ${pVocabulary.name}: already exists and ${application}`);
        }
        logger.debug('Creating vocabulary');
        vocabulary = new Vocabulary({
            id: pVocabulary.name,
            application
        });
        return vocabulary.save();
    }

    static async getAll(application, filter) {
        const limit = (isNaN(parseInt(filter.limit, 10))) ? 0 : parseInt(filter.limit, 10);
        logger.debug('Getting vocabularies');
        const vocabularies = await Vocabulary.find({ application }).limit(limit).exec();
        return vocabularies;
    }

    static async getById(application, pVocabulary) {
        logger.debug(`Getting vocabulary with id ${pVocabulary.name} and application ${application}`);
        const query = {
            id: pVocabulary.name,
            application
        };
        logger.debug('Getting vocabulary');
        const vocabulary = await Vocabulary.find(query).exec();
        if (vocabulary.length === 1) {
            return vocabulary[0];
        }
        return vocabulary;
    }

    /*
    * @returns: hasPermission: <Boolean>
    */
    static hasPermission() {
        return true;
    }

}

module.exports = VocabularyService;
