
class VocabularySerializer {

    static serialize(data) {

        const result = {
            data: []
        };
        if (data) {
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((el) => {
                result.data.push({
                    id: el.id,
                    type: 'vocabulary',
                    attributes: {
                        resources: el.resources,
                        name: el.id
                    }
                });
            });
        }
        return result;
    }


    static serializeTags(data) {

        const result = {};

        if (data) {
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((el) => {
                el.resources.forEach((resource) => {
                    resource.tags.forEach((tag) => {
                        result[tag] = tag;
                    });
                });
            });
        }
        return {
            data: Object.values(result)
        };
    }

}

module.exports = VocabularySerializer;
