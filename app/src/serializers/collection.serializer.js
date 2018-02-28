
class CollectionSerializer {

    static serializeElement(el) {
        return {
            id: el._id,
            type: 'collection',
            attributes: {
                name: el.name,
                ownerId: el.ownerId,
                resources: el.resources ? el.resources.map((res) => {
                    return {
                        id: res.id,
                        type: res.type
                    };
                }) : []
            }
        };
    }

    static serialize(data) {
        const result = {};
        if (data) {
            if (Array.isArray(data)) {

                result.data = data.map(el => CollectionSerializer.serializeElement(el));
            } else {
                result.data = CollectionSerializer.serializeElement(data);
            }
        }
        return result;
    }

}

module.exports = CollectionSerializer;
