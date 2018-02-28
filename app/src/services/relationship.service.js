
const logger = require('logger');
const VocabularyService = require('services/vocabulary.service');
const ResourceService = require('services/resource.service');
const GraphService = require('services/graph.service');
const RelationshipDuplicated = require('errors/relationship-duplicated.error');
const RelationshipNotFound = require('errors/relationship-not-found.error');
const ResourceNotFound = require('errors/resource-not-found.error');
const VocabularyNotFound = require('errors/vocabulary-not-found.error');

class RelationshipService {

    static checkRelationship(resource, vocabulary) {
        return resource.vocabularies.find((elVocabulary) => {
            return (vocabulary.id === elVocabulary.id);
        });
    }

    static async create(application, user, pVocabulary, dataset, pResource) {
        logger.debug(`Checking entities`);
        let vocabulary = await VocabularyService.getById(application, pVocabulary);
        if (!vocabulary || vocabulary.length === 0) {
            logger.debug(`This Vocabulary doesn't exist, let's create it`);
            vocabulary = await VocabularyService.create(application, user, pVocabulary);
        }
        let resource = await ResourceService.get(dataset, pResource);
        if (!resource) {
            logger.debug(`This resource doesnt' exist, let's create it`);
            resource = await ResourceService.create(dataset, pResource);
        }
        logger.debug(`Checking if relationship doesn't exist yet`);
        const relationship = RelationshipService.checkRelationship(resource, vocabulary);
        if (relationship) {
            throw new RelationshipDuplicated(`This relationship already exists`);
        }
        const tags = Array.from(new Set(pVocabulary.tags));
        try {
            logger.debug(`Relationship in vocabulary`);
            vocabulary.resources.push({
                id: resource.id,
                dataset: resource.dataset,
                type: resource.type,
                tags
            });
            vocabulary.save();
        } catch (err) {
            throw err;
        }
        logger.debug(`Relationship in resource`);
        resource.vocabularies.push({
            id: vocabulary.id,
            application,
            tags
        });
        resource = await resource.save();
        // CREATE GRAPH ASSOCIATION
        if (vocabulary.id === 'knowledge_graph') {
            logger.info('Creating graph association');
            await GraphService.associateTags(resource, tags, application);
        }
        return resource;
    }

    static async createSome(application, user, vocabularies, dataset, pResource) {
        for (let i = 0; i < vocabularies.length; i++) {
            await RelationshipService.create(user, vocabularies[i], dataset, pResource);
        }
        return await ResourceService.get(dataset, pResource);
    }

    static async delete(application, user, pVocabulary, dataset, pResource) {
        logger.debug(`Checking entities`);
        const vocabulary = await VocabularyService.getById(application, pVocabulary);
        if (!vocabulary) {
            logger.debug(`This Vocabulary doesn't exist`);
            throw new VocabularyNotFound(`Vocabulary with name ${pVocabulary.name} doesn't exist`);
        }
        let resource = await ResourceService.get(dataset, pResource);
        if (!resource) {
            logger.debug(`This resource doesnt' exist`);
            throw new ResourceNotFound(`Resource ${pResource.type} - ${pResource.id} and dataset: ${dataset} doesn't exist`);
        }
        logger.debug(`Checking if relationship doesn't exist yet`);
        const relationship = RelationshipService.checkRelationship(resource, vocabulary);
        if (!relationship) {
            throw new RelationshipNotFound(`Relationship between ${vocabulary.id} and ${resource.type} - ${resource.id} and dataset: ${dataset} doesn't exist`);
        }
        let position;
        try {
            logger.debug(`Deleting from vocabulary`);
            vocabulary.resources.splice(position, 1);
            vocabulary.save();
        } catch (err) {
            throw err;
        }
        logger.debug(`Deleting from resource`);
        resource.vocabularies.splice(position, 1);
        resource = await resource.save();
        if (resource.vocabularies.length === 0) {
            logger.debug(`Deleting the resource cause it doesnt have any vocabulary`);
            await ResourceService.delete(resource.dataset, resource);
        }
        return resource;
    }

    static async deleteSome(user, vocabularies, dataset, pResource) {
        for (let i = 0; i < vocabularies.length; i++) {
            await RelationshipService.delete(user, vocabularies[i], dataset, pResource);
        }
        return await ResourceService.get(dataset, pResource);
    }

    static async deleteAll(application, user, dataset, pResource) {
        const resource = await ResourceService.get(dataset, pResource);
        if (!resource || !resource.vocabularies || resource.vocabularies.length === 0) {
            logger.debug(`This resource doesn't have Relationships`);
            throw new RelationshipNotFound(`This resource doesn't have Relationships`);
        }
        const vocabularies = resource.vocabularies.map((vocabulary) => {
            return {
                name: vocabulary.id,
                application
            };
        });
        for (let i = 0; i < vocabularies.length; i++) {
            await RelationshipService.delete(user, vocabularies[i], dataset, pResource);
        }
        return await ResourceService.get(dataset, pResource);
    }

    static async updateTagsFromRelationship(application, user, pVocabulary, dataset, pResource) {
        logger.debug(`Checking entities`);
        const vocabulary = await VocabularyService.getById(application, pVocabulary);
        if (!vocabulary) {
            logger.debug(`This Vocabulary doesn't exist`);
            throw new VocabularyNotFound(`Vocabulary with name ${pVocabulary.name} doesn't exist`);
        }
        let resource = await ResourceService.get(dataset, pResource);
        if (!resource) {
            logger.debug(`This resource doesnt' exist`);
            throw new ResourceNotFound(`Resource ${pResource.type} - ${pResource.id} and dataset: ${dataset} doesn't exist`);
        }
        logger.debug(`Checking if relationship doesn't exist yet`);
        const relationship = RelationshipService.checkRelationship(resource, vocabulary);
        if (!relationship) {
            throw new RelationshipNotFound(`Relationship between ${vocabulary.id} and ${resource.type} - ${resource.id} and dataset: ${dataset} doesn't exist`);
        }
        let position;
        try {
            for (let i = 0, length = vocabulary.resources.length; i < length; i++) {
                if (vocabulary.resources[i].type === resource.type && vocabulary.resources[i].id === resource.id) {
                    position = i;
                    break;
                }
            }
            logger.debug(`Tags to vocabulary`);
            vocabulary.resources[position].tags = pVocabulary.tags;
            vocabulary.save();
        } catch (err) {
            throw err;
        }
        logger.debug(`Tags to resource`);
        position = 0;
        for (let i = 0, length = resource.vocabularies.length; i < length; i++) {
            if (resource.vocabularies[i].id === vocabulary.id && resource.vocabularies[i].application === pVocabulary.application) {
                position = i;
                break;
            }
        }
        resource.vocabularies[position].tags = vocabulary.tags;
        resource = await resource.save();
        // CREATE GRAPH ASSOCIATION
        if (vocabulary.id === 'knowledge_graph') {
            logger.info('Creating graph association');
            await GraphService.associateTags(resource, vocabulary.tags, pVocabulary.application);
        }
        return resource;
    }

    static async concatTags(application, user, pVocabulary, dataset, pResource) {
        logger.debug(`Checking entities`);
        let vocabulary = await VocabularyService.getById(application, pVocabulary);
        if (!vocabulary) {
            logger.debug(`This Vocabulary doesn't exist, let's create it`);
            vocabulary = await VocabularyService.create(application, user, pVocabulary);
        }
        let resource = await ResourceService.get(dataset, pResource);
        if (!resource) {
            logger.debug(`This resource doesnt' exist, let's create it`);
            resource = await ResourceService.create(dataset, pResource);
        }
        logger.debug(`Checking if relationship doesn't exist yet`);
        const relationship = RelationshipService.checkRelationship(resource, vocabulary);
        if (!relationship) {
            return await RelationshipService.create(application, user, pVocabulary, dataset, pResource);
        }
        try {
            body.tags.forEach((el) => {
                if (relationship.tags.indexOf(el) < 0) {
                    relationship.tags.push(el);
                }
            });
            return await RelationshipService.updateTagsFromRelationship(user, pVocabulary, dataset, pResource, relationship);
        } catch (err) {
            throw err;
        }
    }

    static async cloneVocabularyTags(application, user, dataset, pResource) {
        logger.debug(`Checking entities`);
        const resource = await ResourceService.get(dataset, pResource);
        if (!resource) {
            throw new ResourceNotFound(`Resource ${pResource.type} - ${pResource.id} and dataset: ${dataset} doesn't exist`);
        }
        const vocabularies = resource.toObject().vocabularies;
        vocabularies.map((vocabulary) => {
            vocabulary.name = vocabulary.id;
            delete vocabulary.id;
            return vocabulary;
        });
        logger.debug('New Vocabularies', vocabularies);
        try {
            return await RelationshipService.createSome(user, vocabularies, body.newDataset, { type: 'dataset', id: body.newDataset });
        } catch (err) {
            throw err;
        }
    }

}

module.exports = RelationshipService;
