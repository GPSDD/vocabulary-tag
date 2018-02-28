const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');

class GraphService {

    static async associateTags(resource, tags, application) {
        logger.info('[GraphService]: Associating tags in the graph db');
        try {
            return await ctRegisterMicroservice.requestToMicroservice({
                uri: `/graph/${resource.type}/${resource.id}/associate`,
                method: 'POST',
                json: true,
                application,
                body: {
                    tags
                }
            });
        } catch (e) {
            logger.error(e);
            throw new Error(e);
        }
    }

}

module.exports = GraphService;
