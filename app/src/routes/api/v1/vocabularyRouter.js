'use strict';

var Router = require('koa-router');
var logger = require('logger');
var config = require('config');
const VocabularyService = require('services/vocabularyService');
const ResourceService = require('services/resourceService');
const RelationshipService = require('services/relationshipService');
const VocabularySerializer = require('serializers/vocabularySerializer');
const ResourceSerializer = require('serializers/resourceSerializer');
const VocabularyValidator = require('validators/vocabularyValidator');
const VocabularyNotFound = require('errors/vocabularyNotFound');
const VocabularyDuplicated = require('errors/vocabularyDuplicated');
const VocabularyNotValid = require('errors/vocabularyNotValid');
const RelationshipValidator = require('validators/relationshipValidator');
const RelationshipDuplicated = require('errors/relationshipDuplicated');
const RelationshipNotValid = require('errors/relationshipNotValid');
const RelationshipNotFound = require('errors/relationshipNotFound');
const ConsistencyViolation = require('errors/consistencyViolation');
const ResourceNotFound = require('errors/resourceNotFound');
const USER_ROLES = require('appConstants').USER_ROLES;

var router = new Router();

class VocabularyRouter {

    static getResource(params){
        let resource = {id: params.dataset, type: 'dataset'};
        if(params.layer){
            resource = {id: params.layer, type: 'layer'};
        }
        else if(params.widget){
            resource = {id: params.widget, type: 'widget'};
        }
        else{}
        return resource;
    }

    static getResourceTypeByPath(path){
        let type = 'dataset';
        if(path.indexOf('layer') > -1){
            type = 'layer';
        }
        else if(path.indexOf('widget') > -1){
            type = 'widget';
        }
        else{}
        return type;
    }

    static * get(){
        let query = this.request.query;
        if(Object.keys(query).length === 0){
            this.throw(400, 'Vocabulary and Tags are required in the queryParams');
            return;
        }
        logger.info(`Getting resources by vocabulary-tag`);
        let resource = {};
        resource.type = VocabularyRouter.getResourceTypeByPath(this.path);
        let result = yield VocabularyService.get(resource, query);
        this.body = VocabularySerializer.serialize(result);
    }

    static * create(){
        logger.info(`Creating vocabulary with name: ${this.request.body.name}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield VocabularyService.create(user, this.request.body);
            this.body = VocabularySerializer.serialize(result);
        } catch(err) {
            if(err instanceof VocabularyDuplicated){
                this.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static * update(){
        logger.info(`Updating vocabulary with name: ${this.request.body.name}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield VocabularyService.update(user, this.request.body);
            this.body = VocabularySerializer.serialize(result);
        } catch(err) {
            if(err instanceof VocabularyNotFound){
                this.throw(400, err.message);
                return;
            }
            else if(err instanceof ConsistencyViolation){
                this.throw(409, err.message);
                return;
            }
            throw err;
        }
    }

    static * delete(){
        logger.info(`Updating vocabulary with name: ${this.request.body.name}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield VocabularyService.delete(user, this.request.body);
            this.body = VocabularySerializer.serialize(result);
        } catch(err) {
            if(err instanceof VocabularyNotFound){
                this.throw(400, err.message);
                return;
            }
            else if(err instanceof ConsistencyViolation){
                this.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static * getAll(){
        logger.info('Getting all vocabularies');
        let filter = {};
        if(this.query.limit){filter.limit = this.query.limit;}
        let result = yield VocabularyService.getAll(filter);
        this.body = VocabularySerializer.serialize(result);
    }

    static * getById(){
        logger.info(`Getting vocabulary by name: ${this.params.vocabulary}`);
        let vocabulary = {name: this.params.vocabulary};
        let result = yield VocabularyService.getById(vocabulary);
        this.body = VocabularySerializer.serialize(result);
    }

    /* Using the Resource Service */

    static * getByResource(){
        let resource = VocabularyRouter.getResource(this.params);
        logger.info(`Getting vocabularies of ${resource.type}: ${resource.id}`);
        let filter = {};
        let vocabulary = {name: this.params.vocabulary};
        let result = yield ResourceService.get(this.params.dataset, resource, vocabulary);
        this.body = ResourceSerializer.serialize(result);
    }

    static * getByIds(){
        if(!this.request.body.ids){
            this.throw(400, 'Bad request');
            return;
        }
        logger.info(`Getting vocabularies by ids: ${this.request.body.ids}`);
        let resource = {
            ids: this.request.body.ids
        };
        if(typeof resource.ids === 'string'){
            resource.ids = resource.ids.split(',').map(function(elem){return elem.trim();});
        }
        resource.type = VocabularyRouter.getResourceTypeByPath(this.path);
        let result = yield ResourceService.getByIds(resource);
        this.body = ResourceSerializer.serialize(result);
    }

    static * createRelationship(){
        let dataset = this.params.dataset;
        let vocabulary = {name: this.params.vocabulary};
        let resource = VocabularyRouter.getResource(this.params);
        let body = this.request.body;
        logger.info(`Creating realtionship between vocabulary: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield RelationshipService.create(user, vocabulary, dataset, resource, body);
            this.body = ResourceSerializer.serialize(result);
        } catch(err) {
            if(err instanceof RelationshipDuplicated){
                this.throw(400, err.message);
                return;
            }
            throw err;
        }
    }

    static * deleteRelationship(){
        let dataset = this.params.dataset;
        let vocabulary = {name: this.params.vocabulary};
        let resource = VocabularyRouter.getResource(this.params);
        logger.info(`Deleting Relationship between: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield RelationshipService.delete(user, vocabulary, dataset, resource);
            this.body = ResourceSerializer.serialize(result);
        } catch(err) {
            if(err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound){
                this.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static * updateRelationshipTags(){
        let dataset = this.params.dataset;
        let vocabulary = {name: this.params.vocabulary};
        let resource = VocabularyRouter.getResource(this.params);
        let body = this.request.body; //@TODO VALIDATE if body.tags > 0 in other case validation erro
        logger.info(`Updating tags of relationship: ${vocabulary.name} and resource: ${resource.type} - ${resource.id}`);
        try{
            let user = this.request.body.loggedUser;
            let result = yield RelationshipService.updateTagsFromRelationship(user, vocabulary, dataset, resource, body);
            this.body = ResourceSerializer.serialize(result);
        } catch(err) {
            if(err instanceof VocabularyNotFound || err instanceof ResourceNotFound || err instanceof RelationshipNotFound){
                this.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

}

// Negative checking
const authorizationMiddleware = function*(next) {
    this.request.body.loggedUser = {
      'id': '5810d796e97e7b2d6a1fdab7',
      'provider': 'local',
      'providerId': null,
      'email': 'prueba@vizzuality.com',
      'role': 'ADMIN',
      'createdAt': '2016-10-26T16:19:34.728Z',
      'extraUserData': {
        'apps': [
          'gfw',
          'prep'
        ]
      },
      'iat': 1480526868
    };
    yield next; // SUPERADMIN is included here
};

// Resource Validator Wrapper
const relationshipValidationMiddleware = function*(next){
    try{
        yield RelationshipValidator.validate(this);
    } catch(err) {
        if(err instanceof RelationshipNotValid){
            this.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    yield next;
};

// Vocabulary Validator Wrapper
const vocabularyValidationMiddleware = function*(next){
    try{
        yield VocabularyValidator.validate(this);
    } catch(err) {
        if(err instanceof VocabularyNotValid){
            this.throw(400, err.getMessages());
            return;
        }
        throw err;
    }
    yield next;
};


// dataset
router.get('/dataset/:dataset/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/vocabulary', VocabularyRouter.get);
router.post('/dataset/:dataset/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.delete('/dataset/:dataset/vocabulary/:vocabulary', authorizationMiddleware, VocabularyRouter.deleteRelationship);

// widget
router.get('/dataset/:dataset/widget/:widget/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/widget/vocabulary', VocabularyRouter.get);
router.post('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.delete('/dataset/:dataset/widget/:widget/vocabulary/:vocabulary', authorizationMiddleware, VocabularyRouter.deleteRelationship);

// layer
router.get('/dataset/:dataset/layer/:layer/vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', VocabularyRouter.getByResource);
router.get('/dataset/:dataset/layer/vocabulary', VocabularyRouter.get);
router.post('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.createRelationship);
router.patch('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', relationshipValidationMiddleware, authorizationMiddleware, VocabularyRouter.updateRelationshipTags);
router.delete('/dataset/:dataset/layer/:layer/vocabulary/:vocabulary', authorizationMiddleware, VocabularyRouter.deleteRelationship);

// vocabulary (not the commmon use case)
router.get('/vocabulary', VocabularyRouter.getAll);
router.get('/vocabulary/:vocabulary', VocabularyRouter.getById);
router.post('/vocabulary/:vocabulary', vocabularyValidationMiddleware, authorizationMiddleware, VocabularyRouter.create);
router.patch('/vocabulary/:vocabulary', vocabularyValidationMiddleware, authorizationMiddleware, VocabularyRouter.update);
router.delete('/vocabulary/:vocabulary', authorizationMiddleware, VocabularyRouter.delete);

// get by ids (to include queries) //@TODO
router.post('/dataset/vocabulary/get-by-ids', VocabularyRouter.getByIds);
router.post('/dataset/:dataset/widget/vocabulary/get-by-ids', VocabularyRouter.getByIds);
router.post('/dataset/:dataset/layer/vocabulary/get-by-ids', VocabularyRouter.getByIds);

module.exports = router;
