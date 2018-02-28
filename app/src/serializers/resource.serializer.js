
class ResourceSerializer {

    static serialize(data) {

        const result = {
            data: []
        };
        if (data) {
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((el) => {
                el.vocabularies.forEach((vocabulary) => {
                    result.data.push({
                        id: vocabulary.id,
                        type: 'vocabulary',
                        attributes: {
                            tags: vocabulary.tags,
                            name: vocabulary.id
                        }
                    });
                });
            });
        }
        return result;
    }

    static serializeByIds(data) {

        const result = {
            data: []
        };
        if (data) {
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((el) => {
                el.vocabularies.forEach((vocabulary) => {
                    result.data.push({
                        type: 'vocabulary',
                        attributes: {
                            resource: {
                                id: el.id,
                                type: el.type
                            },
                            tags: vocabulary.tags,
                            name: vocabulary.id
                        }
                    });
                });
            });
        }
        return result;
    }

}

module.exports = ResourceSerializer;
