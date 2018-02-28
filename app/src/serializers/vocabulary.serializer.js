
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

}

module.exports = VocabularySerializer;
