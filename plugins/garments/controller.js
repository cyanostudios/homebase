// plugins/garments/controller.js

class GarmentsController {
  constructor(model) {
    this.model = model;
  }

  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    return {
      field: 'articleName',
      message: 'An inventory item with this article and brand already exists',
    };
  }

  async getLists(req, res, next) {
    try {
      const lists = await this.model.getLists(req, { teamId: req.query.team_id });
      res.json(lists);
    } catch (error) {
      next(error);
    }
  }

  async getListsForContact(req, res, next) {
    try {
      const lists = await this.model.getListsForContact(req, req.params.contactId);
      res.json(lists);
    } catch (error) {
      next(error);
    }
  }

  async getList(req, res, next) {
    try {
      const list = await this.model.getListById(req, req.params.id);
      if (!list) {
        return res.status(404).json({ error: 'List not found' });
      }
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async createList(req, res, next) {
    try {
      const list = await this.model.createList(req, req.body);
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async updateList(req, res, next) {
    try {
      const list = await this.model.updateList(req, req.params.id, req.body);
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async deleteList(req, res, next) {
    try {
      await this.model.deleteList(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async getPersons(req, res, next) {
    try {
      const persons = await this.model.getPersonsForList(req, req.params.id);
      res.json(persons);
    } catch (error) {
      next(error);
    }
  }

  async createPerson(req, res, next) {
    try {
      const person = await this.model.createPerson(req, req.params.id, req.body);
      res.json(person);
    } catch (error) {
      next(error);
    }
  }

  async updatePerson(req, res, next) {
    try {
      const person = await this.model.updatePerson(
        req,
        req.params.id,
        req.params.personId,
        req.body,
      );
      res.json(person);
    } catch (error) {
      next(error);
    }
  }

  async deletePerson(req, res, next) {
    try {
      await this.model.deletePerson(req, req.params.id, req.params.personId);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async assignInventoryItemToList(req, res, next) {
    try {
      const list = await this.model.assignInventoryItemToList(
        req,
        req.params.id,
        req.params.itemId,
      );
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async unassignInventoryItemFromList(req, res, next) {
    try {
      const list = await this.model.unassignInventoryItemFromList(
        req,
        req.params.id,
        req.params.itemId,
      );
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async updatePersonCtSizes(req, res, next) {
    try {
      const person = await this.model.updatePersonCtSizes(
        req,
        req.params.id,
        req.params.personId,
        req.body.ctSizes ?? req.body.ct_sizes,
        req.body.ctAudiences ?? req.body.ct_audiences,
      );
      res.json(person);
    } catch (error) {
      next(error);
    }
  }

  async createShare(req, res, next) {
    try {
      const { listId, validUntil } = req.body;
      const validUntilDate = new Date(validUntil);
      const share = await this.model.createShare(req, listId, validUntilDate);
      res.json(share);
    } catch (error) {
      next(error);
    }
  }

  async getShares(req, res, next) {
    try {
      const shares = await this.model.getSharesForList(req, req.params.id);
      res.json(shares);
    } catch (error) {
      next(error);
    }
  }

  async revokeShare(req, res, next) {
    try {
      const share = await this.model.revokeShare(req, req.params.shareId);
      res.json({ message: 'Share revoked successfully', share });
    } catch (error) {
      next(error);
    }
  }

  async getPublicList(req, res, next) {
    try {
      const list = await this.model.getListByShareToken(req, req.params.token);
      if (!list) {
        return res.status(404).json({
          error: 'List not found or share link has expired',
        });
      }
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  async getInventory(req, res, next) {
    try {
      const items = await this.model.getInventory(req);
      res.json(items);
    } catch (error) {
      next(error);
    }
  }

  async getInventoryItem(req, res, next) {
    try {
      const item = await this.model.getInventoryById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  }

  async createInventoryItem(req, res, next) {
    try {
      const item = await this.model.createInventoryItem(req, req.body);
      res.json(item);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async updateInventoryItem(req, res, next) {
    try {
      const item = await this.model.updateInventoryItem(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async deleteInventoryItem(req, res, next) {
    try {
      await this.model.deleteInventoryItem(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async createInventoryVariant(req, res, next) {
    try {
      const variant = await this.model.createInventoryVariant(req, req.params.id, req.body);
      res.json(variant);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async updateInventoryVariant(req, res, next) {
    try {
      const variant = await this.model.updateInventoryVariant(
        req,
        req.params.id,
        req.params.variantId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      const mapped = this.mapUniqueViolation(error);
      if (mapped) {
        return res.status(409).json({ errors: [mapped] });
      }
      next(error);
    }
  }

  async updateInventoryVariantQuantity(req, res, next) {
    try {
      const variant = await this.model.updateInventoryVariantQuantity(
        req,
        req.params.id,
        req.params.variantId,
        req.body.quantity,
      );
      res.json(variant);
    } catch (error) {
      next(error);
    }
  }

  async deleteInventoryVariant(req, res, next) {
    try {
      await this.model.deleteInventoryVariant(req, req.params.id, req.params.variantId);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GarmentsController;
