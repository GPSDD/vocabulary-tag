const Router = require('koa-router');
const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const CollectionModel = require('models/collection.model');
const CollectionSerializer = require('serializers/collection.serializer');
const CollectionValidator = require('validators/collection.validator');

const router = new Router({
    prefix: '/collection'
});

class CollectionRouter {

    static getUser(ctx) {
        return JSON.parse(ctx.headers.user_key) ? JSON.parse(ctx.headers.user_key) : { id: null };
    }

    static getApplication(ctx) {
        return JSON.parse(ctx.headers.app_key).application;
    }

    static async getAll(ctx) {
        logger.info('Obtaining collection by user');
        const application = CollectionRouter.getApplication(ctx);
        const user = CollectionRouter.getUser(ctx);
        const filters = {
            ownerId: user.id,
            application
        };

        const data = await CollectionModel.find(filters);

        if (ctx.query.include && ctx.query.include === 'true') {
            logger.debug('including resources');
            const widgets = [];
            const datasets = [];
            const layers = [];
            data.forEach((resource) => {
                if (resource.resourceType === 'dataset') {
                    datasets.push(resource.resourceId);
                } else if (resource.resourceType === 'layer') {
                    layers.push(resource.resourceId);
                } else {
                    widgets.push(resource.resourceId);
                }
            });

            try {
                if (datasets.length > 0) {
                    logger.debug('Loading datasets');
                    const datasetResources = await ctRegisterMicroservice.requestToMicroservice({
                        uri: `/dataset?ids=${datasets.join(',')}`,
                        method: 'GET',
                        application,
                        json: true
                    });
                    for (let i = 0, length = datasetResources.data.length; i < length; i++) {
                        const dataset = datasetResources.data[i];
                        for (let j = 0, lengthData = data.length; j < lengthData; j++) {
                            if (data[j].resourceType === 'dataset' && data[j].resourceId === dataset.id) {
                                data[j] = data[j].toObject();
                                data[j].resource = dataset;
                                break;
                            }
                        }
                    }
                }
                logger.debug('Loading widgets', widgets);
                if (widgets.length > 0) {
                    logger.debug('Loading widgets', widgets);
                    const widgetResources = await ctRegisterMicroservice.requestToMicroservice({
                        uri: `/widget?ids=${widgets.join(',')}`,
                        method: 'GET',
                        application,
                        json: true
                    });
                    logger.info('Obtained', widgetResources);

                    for (let i = 0, length = widgetResources.data.length; i < length; i++) {
                        const widget = widgetResources.data[i];
                        for (let j = 0, lengthData = data.length; j < lengthData; j++) {
                            if (data[j].resourceType === 'widget' && data[j].resourceId === widget.id) {
                                data[j] = data[j].toObject();
                                data[j].resource = widget;
                                break;
                            }
                        }
                    }
                }
                logger.info('Loading layers', layers);
                if (layers.length > 0) {
                    logger.info('Loading layers', layers);
                    for (let i = 0, length = layers.length; i < length; i++) {
                        try {
                            const layerResource = await ctRegisterMicroservice.requestToMicroservice({
                                uri: `/layer/${layers[i]}`,
                                method: 'GET',
                                application,
                                json: true
                            });
                            for (let j = 0, lengthData = data.length; j < lengthData; j++) {
                                if (data[j].resourceType === 'layer' && data[j].resourceId === layers[i]) {
                                    data[j] = data[j].toObject();
                                    data[j].resource = layerResource.data;
                                    break;
                                }
                            }
                        } catch (err) {
                            logger.error(err);
                        }
                    }
                }
            } catch (err) {
                logger.error(err);
                ctx.throw(400, 'Error obtaining include');
            }
        }
        ctx.body = CollectionSerializer.serialize(data);
    }
    static async findByIds(ctx) {

        logger.info('Obtaining collection by user');
        const filters = {
            _id: {
                $in: ctx.request.body.ids
            },
            ownerId: ctx.request.body.userId
        };
        const data = await CollectionModel.find(filters);
        ctx.body = CollectionSerializer.serialize(data);
    }

    static async getById(ctx) {
        logger.info('Obtaining collection by id', ctx.params.id);
        ctx.body = CollectionSerializer.serialize(ctx.state.col);
    }

    static async postCollection(ctx) {
        logger.info('Creating collection with body ', ctx.request.body);
        const application = CollectionRouter.getApplication(ctx);
        const user = CollectionRouter.getUser(ctx);
        const body = {
            name: ctx.request.body.name,
            application,
            ownerId: user.id,
            resources: ctx.request.body.resources || []
        };
        const data = await new CollectionModel(body).save();
        ctx.body = CollectionSerializer.serialize(data);
    }

    static async postResource(ctx) {
        logger.info('Creating new resource in collection with id ', ctx.params.id);
        ctx.state.col.resources.push(ctx.request.body);
        await ctx.state.col.save();
        ctx.body = CollectionSerializer.serialize(ctx.state.col);
    }

    static async patchCollection(ctx) {
        logger.info('Updating collection by id ', ctx.params.id);
        ctx.state.col.name = ctx.request.body.name;
        await ctx.state.col.save();
        ctx.body = CollectionSerializer.serialize(ctx.state.col);
    }

    static async deleteCollection(ctx) {
        logger.info('Deleting collection by id ', ctx.params.id);
        await ctx.state.col.remove();
        ctx.body = CollectionSerializer.serialize(ctx.state.col);
    }


    static async deleteResource(ctx) {
        ctx.state.col.resources = ctx.state.col.resources
            .filter(res => res.id !== ctx.params.resourceId || res.type !== ctx.params.resourceType);
        await ctx.state.col.save();
        ctx.body = CollectionSerializer.serialize(ctx.state.col);
    }

}

const existCollection = async (ctx, next) => {
    logger.debug('Checking if collection exists');
    const user = CollectionRouter.getUser(ctx);
    const col = await CollectionModel.findById(ctx.params.id);
    if (!col || ((user.id !== col.ownerId) && user.role !== 'ADMIN')) {
        ctx.throw(404, 'Collection not found');
        return;
    }
    ctx.state.col = col;
    await next();
};

const existResourceInCollection = async (ctx, next) => {
    logger.debug('Checking if resource exists in collection');
    const exist = ctx.state.col.resources.find(res => res.id === ctx.request.body.id && res.type === ctx.request.body.type);
    if (exist) {
        ctx.throw(400, 'Resource duplicated');
        return;
    }
    await next();
};

const validationMiddleware = async (ctx, next) => {
    logger.info(`[DatasetRouter] Validating`);
    try {
        await CollectionValidator.validate(ctx);
    } catch (err) {
        ctx.throw(400, err);
    }
    await next();
};

router.get('/', CollectionRouter.getAll);
router.get('/:id', existCollection, CollectionRouter.getById);

router.post('/', validationMiddleware, CollectionRouter.postCollection);
router.post('/:id/resource', existCollection, existResourceInCollection, CollectionRouter.postResource);
router.post('/find-by-ids', CollectionRouter.findByIds);

router.patch('/:id', existCollection, CollectionRouter.patchCollection);

router.delete('/:id', existCollection, CollectionRouter.deleteCollection);
router.delete('/:id/resource/:resourceType/:resourceId', existCollection, CollectionRouter.deleteResource);

module.exports = router;
