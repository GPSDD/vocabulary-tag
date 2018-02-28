const Router = require('koa-router');
const logger = require('logger');
const VocabularyService = require('services/vocabulary.service');
const ResourceService = require('services/resource.service');
const RelationshipService = require('services/relationship.service');
const VocabularySerializer = require('serializers/vocabulary.serializer');
const ResourceSerializer = require('serializers/resource.serializer');
const VocabularyValidator = require('validators/vocabulary.validator');
const RelationshipValidator = require('validators/relationship.validator');
const CloneValidator = require('validators/clone.validator');
const RelationshipsValidator = require('validators/relationships.validator');
const VocabularyNotFound = require('errors/vocabulary-not-found.error');
const VocabularyDuplicated = require('errors/vocabulary-duplicated.error');
const VocabularyNotValid = require('errors/vocabulary-not-valid.error');
const RelationshipDuplicated = require('errors/relationship-duplicated.error');
const RelationshipNotValid = require('errors/relationship-not-valid.error');
const CloneNotValid = require('errors/clone-not-valid.error');
const RelationshipsNotValid = require('errors/relationships-not-valid.error');
const RelationshipNotFound = require('errors/relationship-not-found.error');
const ResourceNotFound = require('errors/resource-not-found.error');
const USER_ROLES = require('app.constants').USER_ROLES;

const router = new Router();

class VocabularyRouter {

    static getUser(ctx) {
        return JSON.parse(ctx.headers.user_key) ? JSON.parse(ctx.headers.user_key) : { id: null };
    }

    static getApplication(ctx) {
        return JSON.parse(ctx.headers.app_key).application;
    }

    static getResource(params) {
        let resource = { id: params.dataset, type: 'dataset' };
        if (params.layer) {
            resource = { id: params.layer, type: 'layer' };
        } else if (params.widget) {
            resource = { id: params.widget, type: 'widget' };
        }
        return resource;
    }

    static getResourceTypeByPath(path) {
        let type = 'dataset';
        if (path.indexOf('layer') > -1) {
            type = 'layer';
        } else if (path.indexOf('widget') > -1) {
            type = 'widget';
        }
        return type;
    }

    static async get(ctx) {
        const query = ctx.request.query;
        if (Object.keys(query).length === 1) {
            ctx.throw(400, 'Vocabulary and Tags are required in the queryParams');
            return;
        }
        logger.info(`Getting resources by vocabulary-tag`);
        const resource = {};
        const application = VocabularyRouter.getApplication(ctx);
        resource.type = VocabularyRouter.getResourceTypeByPath(ctx.path);
        const result = await VocabularyService.get(application, resource, query);
        ctx.body = VocabularySerializer.serialize(result);
    }

    static async create(ctx) {
        logger.info(`Creating vocabulary with name: ${ctx.request.body.name}`);
        try {
            const user = VocabularyRouter.getUser(ctx);
            const application = VocabularyRouter.getApplication(ctx);
            const result = await VocabularyService.create(application, user, ctx.request.body);
            ctx.body = VocabularySerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyDuplicated) {
                ctx.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static async getAll(ctx) {
        logger.info('Getting all vocabularies');
        const filter = {};
        if (ctx.query.limit) { filter.limit = ctx.query.limit; }
        const application = VocabularyRouter.getApplication(ctx);
        const result = await VocabularyService.getAll(application, filter);
        ctx.body = VocabularySerializer.serialize(result);
    }

    static async getById(ctx) {
        logger.info(`Getting vocabulary by name: ${ctx.params.vocabulary}`);
        const application = VocabularyRouter.getApplication(ctx);
        const vocabulary = { name: ctx.params.vocabulary };
        const result = await VocabularyService.getById(application, vocabulary);
        ctx.body = VocabularySerializer.serialize(result);
    }

    /* Using the Resource Service */
    static async getByResource(ctx) {
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Getting vocabularies of ${resource.type}: ${resource.id}`);
        const dataset = ctx.params.dataset;
        const vocabulary = { name: ctx.params.vocabulary };
        const result = await ResourceService.get(dataset, resource, vocabulary);
        ctx.body = ResourceSerializer.serialize(result);
    }

    static async getByIds(ctx) {
        if (!ctx.request.body.ids) {
            ctx.throw(400, 'Bad request');
            return;
        }
        logger.info(`Getting vocabularies by ids: ${ctx.request.body.ids}`);
        const resource = {
            ids: ctx.request.body.ids,
            application: VocabularyRouter.getApplication(ctx)
        };
        if (typeof resource.ids === 'string') {
            resource.ids = resource.ids.split(',').map(elem => elem.trim());
        }
        resource.type = VocabularyRouter.getResourceTypeByPath(ctx.path);
        const result = await ResourceService.getByIds(resource);
        ctx.body = ResourceSerializer.serializeByIds(result); //
    }

    static async createRelationship(ctx) {
        const dataset = ctx.params.dataset;
        const application = VocabularyRouter.getApplication(ctx);
        const vocabulary = { name: ctx.params.vocabulary, tags: ctx.request.body.tags };
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Creating realtionship between vocabulary: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try {
            const user = VocabularyRouter.getUser(ctx);
            const result = await RelationshipService.create(application, user, vocabulary, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof RelationshipDuplicated) {
                ctx.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static async createRelationships(ctx) {
        const application = VocabularyRouter.getApplication(ctx);
        const dataset = ctx.params.dataset;
        const resource = VocabularyRouter.getResource(ctx.params);
        const body = ctx.request.body;
        const vocabularies = [];
        Object.keys(body).forEach((key) => {
            if (key !== 'loggedUser') {
                vocabularies.push({
                    name: key,
                    application,
                    tags: body[key].tags
                });
            }
        });
        vocabularies.forEach((vocabulary) => {
            logger.info(`Creating realtionships between vocabulary: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        });
        try {
            const user = VocabularyRouter.getUser(ctx);
            const result = await RelationshipService.createSome(application, user, vocabularies, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof RelationshipDuplicated) {
                ctx.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static async updateRelationships(ctx) {
        const application = VocabularyRouter.getApplication(ctx);
        const user = VocabularyRouter.getUser(ctx);
        const dataset = ctx.params.dataset;
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Deleting All Vocabularies of resource: ${resource.type} - ${resource.id}`);
        try {
            const result = await RelationshipService.deleteAll(application, user, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound) {
                ctx.throw(404, err.message);
                return;
            } else if (err instanceof RelationshipNotFound) {
                // do nothing
            } else {
                throw err;
            }
        }
        const body = ctx.request.body;
        const vocabularies = [];
        Object.keys(body).forEach((key) => {
            if (key !== 'loggedUser') {
                vocabularies.push({
                    name: key,
                    application,
                    tags: body[key].tags
                });
            }
        });
        vocabularies.forEach((vocabulary) => {
            logger.info(`Creating realtionships between vocabulary: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        });
        try {
            const result = await RelationshipService.createSome(application, user, vocabularies, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof RelationshipDuplicated) {
                ctx.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static async deleteRelationship(ctx) {
        const application = VocabularyRouter.getApplication(ctx);
        const user = VocabularyRouter.getUser(ctx);
        const dataset = ctx.params.dataset;
        const vocabulary = { name: ctx.params.vocabulary };
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Deleting Relationship between: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try {
            const result = await RelationshipService.delete(application, user, vocabulary, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async deleteRelationships(ctx) {
        const application = VocabularyRouter.getApplication(ctx);
        const user = VocabularyRouter.getUser(ctx);
        const dataset = ctx.params.dataset;
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Deleting All Vocabularies of resource: ${resource.type} - ${resource.id}`);
        try {
            const result = await RelationshipService.deleteAll(application, user, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async updateRelationshipTags(ctx) {
        const dataset = ctx.params.dataset;
        const user = VocabularyRouter.getUser(ctx);
        const application = VocabularyRouter.getApplication(ctx);
        const vocabulary = { name: ctx.params.vocabulary, tags: ctx.request.body.tags };
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Updating tags of relationship: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try {
            const result = await RelationshipService.updateTagsFromRelationship(application, user, vocabulary, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async concatTags(ctx) {
        const dataset = ctx.params.dataset;
        const application = VocabularyRouter.getApplication(ctx);
        const user = VocabularyRouter.getUser(ctx);
        const vocabulary = { name: ctx.params.vocabulary, tags: ctx.request.body.tags };
        const resource = VocabularyRouter.getResource(ctx.params);
        logger.info(`Conacatenating more tags in relationship: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try {
            const result = await RelationshipService.concatTags(application, user, vocabulary, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async cloneVocabularyTags(ctx) {
        const dataset = ctx.params.dataset;
        const application = VocabularyRouter.getApplication(ctx);
        const user = VocabularyRouter.getUser(ctx);
        const resource = VocabularyRouter.getResource(ctx.params);
        const body = ctx.request.body;
        const newDataset = body.newDataset;
        logger.info(`Cloning relationships: of resource ${resource.type} - ${resource.id} in ${newDataset}`);
        try {
            const result = await RelationshipService.cloneVocabularyTags(application, user, dataset, resource);
            ctx.body = ResourceSerializer.serialize(result);
        } catch (err) {
            if (err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

}

// Negative checking
const relationshipAuthorizationMiddleware = async (ctx, next) => {
    // Get user from query (delete) or body (post-patch)
    const dataset = ctx.params.dataset;
    const application = VocabularyRouter.getApplication(ctx);
    const user = VocabularyRouter.getUser(ctx);
    if (user.id === 'microservice') {
        await next();
        return;
    }
    if (!user || USER_ROLES.indexOf(user.role) === -1) {
        ctx.throw(401, 'Unauthorized'); // if not logged or invalid ROLE-> out
        return;
    }
    if (user.role === 'USER') {
        ctx.throw(403, 'Forbidden'); // if USER -> out
        return;
    }
    if (user.role === 'MANAGER' || user.role === 'ADMIN') {
        const resource = VocabularyRouter.getResource(ctx.params);
        try {
            const permission = await ResourceService.hasPermission(application, user, dataset, resource);
            if (!permission) {
                ctx.throw(403, 'Forbidden');
                return;
            }
        } catch (err) {
            ctx.throw(403, 'Forbidden');
            return;
        }
    }
    await next(); // SUPERADMIN are included here
};

// Negative checking
const vocabularyAuthorizationMiddleware = async (ctx, next) => {
    // Get user from query (delete) or body (post-patch)
    const user = VocabularyRouter.getUser(ctx);
    if (user.id === 'microservice') {
        await next();
        return;
    }
    if (!user || USER_ROLES.indexOf(user.role) === -1) {
        ctx.throw(401, 'Unauthorized'); // if not logged or invalid ROLE -> out
        return;
    }
    if (ctx.request.method === 'POST' && user.role === 'ADMIN') {
        await next();
        return;
    }
    if (user.role !== 'SUPERADMIN') {
        ctx.throw(403, 'Forbidden'); // Only SUPERADMIN
        return;
    }
    await next(); // SUPERADMIN is included here
};

// Resource Validator Wrapper
const relationshipValidationMiddleware = async (ctx, next) => {
    try {
        await RelationshipValidator.validate(ctx);
    } catch (err) {
        if (err instanceof RelationshipNotValid) {
            ctx.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    await next();
};

// RelationshipsValidator Wrapper
const relationshipsValidationMiddleware = async (ctx, next) => {
    try {
        await RelationshipsValidator.validate(ctx);
    } catch (err) {
        if (err instanceof RelationshipsNotValid) {
            ctx.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    await next();
};

// Vocabulary Validator Wrapper
const vocabularyValidationMiddleware = async (ctx, next) => {
    try {
        await VocabularyValidator.validate(ctx);
    } catch (err) {
        if (err instanceof VocabularyNotValid) {
            ctx.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    await next();
};

// Clone Validator Wrapper
const cloneValidationMiddleware = async (ctx, next) => {
    try {
        await CloneValidator.validate(ctx);
    } catch (err) {
        if (err instanceof CloneNotValid) {
            ctx.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    await next();
};

// dataset
router.get('/dataset/:dataset/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/vocabulary/find', VocabularyRouter.get);
router.post('/dataset/:dataset/vocabulary', relationshipsValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationships);
router.put('/dataset/:dataset/vocabulary', relationshipsValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.updateRelationships);
router.post('/dataset/:dataset/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.post('/dataset/:dataset/vocabulary/:vocabulary/concat', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.concatTags);
router.post('/dataset/:dataset/vocabulary/clone/dataset', cloneValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.cloneVocabularyTags);
router.delete('/dataset/:dataset/vocabulary/:vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationship);
router.delete('/dataset/:dataset/vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationships);

// widget
router.get('/dataset/:dataset/widget/:widget/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/widget/vocabulary/find', VocabularyRouter.get);
router.post('/dataset/:dataset/widget/:widget/vocabulary/', relationshipsValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationships);
router.post('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.delete('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationship);
router.delete('/dataset/:dataset/widget/:widget/vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationships);

// layer
router.get('/dataset/:dataset/layer/:layer/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/layer/vocabulary/find', VocabularyRouter.get);
router.post('/dataset/:dataset/layer/:layer/vocabulary', relationshipsValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationships);
router.post('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', relationshipValidationMiddleware, relationshipAuthorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.delete('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationship);
router.delete('/dataset/:dataset/layer/:layer/vocabulary', relationshipAuthorizationMiddleware, VocabularyRouter.deleteRelationships);

// vocabulary (not the commmon use case)
router.get('/vocabulary', VocabularyRouter.getAll);
router.get('/vocabulary/:vocabulary', VocabularyRouter.getById);
router.post('/vocabulary', vocabularyValidationMiddleware, vocabularyAuthorizationMiddleware, VocabularyRouter.create);

// get by ids (to include queries)
router.post('/dataset/vocabulary/get-by-ids', VocabularyRouter.getByIds);
router.post('/dataset/:dataset/widget/vocabulary/get-by-ids', VocabularyRouter.getByIds);
router.post('/dataset/:dataset/layer/vocabulary/get-by-ids', VocabularyRouter.getByIds);

module.exports = router;
