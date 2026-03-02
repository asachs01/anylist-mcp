import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnyListService } from '../../src/services/anylist-service.js';
import { registerListTools } from '../../src/tools/list-tools.js';
import { createMockFastMCP } from '../mocks/fastmcp-mock.js';
import { mockLists, resetMockData } from '../mocks/anylist-mock.js';
import type { AnyListConfig } from '../../src/types/index.js';

// Mock the AnyList module
vi.mock('anylist', () => ({
  default: vi.fn(() => ({
    login: vi.fn(),
    getLists: vi.fn(),
    getRecipes: vi.fn(),
    getMealPlanningCalendarEvents: vi.fn(),
    lists: mockLists,
    recipes: [],
    mealPlanningCalendarEvents: [],
    getListById: vi.fn((id: string) => {
      const list = mockLists.find(l => l.identifier === id);
      if (!list) return null;
      return {
        ...list,
        addItem: vi.fn(async (item) => {
          const newItem = {
            ...item,
            listId: id,
            identifier: `item-${Date.now()}`,
            checked: false,
            manualSortIndex: list.items.length,
            userId: 'user-1',
            categoryMatchId: 'category-1',
          };
          list.items.push(newItem);
          return newItem;
        }),
        getItemById: vi.fn((itemId: string) => {
          const item = list.items.find(i => i.identifier === itemId);
          if (!item) return null;
          return {
            ...item,
            save: vi.fn(async () => item),
          };
        }),
      };
    }),
    createItem: vi.fn((data) => ({
      ...data,
      identifier: `item-${Date.now()}`,
      checked: false,
      manualSortIndex: 0,
      userId: 'user-1',
      categoryMatchId: 'category-1',
    })),
    teardown: vi.fn(),
  })),
}));

describe('List Tools', () => {
  let mockServer: ReturnType<typeof createMockFastMCP>;
  let anylistService: AnyListService;
  const mockConfig: AnyListConfig = {
    email: 'test@example.com',
    password: 'test-password',
  };

  beforeEach(async () => {
    resetMockData();
    mockServer = createMockFastMCP();
    anylistService = new AnyListService(mockConfig);
    
    // Mock the service methods
    vi.spyOn(anylistService, 'getLists').mockResolvedValue(mockLists);
    vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
      const list = mockLists.find(l => l.identifier === request.listId);
      if (!list) {
        throw new Error(`List with ID ${request.listId} not found`);
      }
      
      const newItem = {
        listId: request.listId,
        identifier: `item-${Date.now()}`,
        name: request.name,
        details: request.details,
        quantity: request.quantity,
        checked: false,
        manualSortIndex: list.items.length,
        userId: 'user-1',
        categoryMatchId: 'category-1',
      };
      
      list.items.push(newItem);
      return newItem;
    });
    
    vi.spyOn(anylistService, 'updateItem').mockImplementation(async (request) => {
      const list = mockLists.find(l => l.identifier === request.listId);
      if (!list) {
        throw new Error(`List with ID ${request.listId} not found`);
      }
      
      const item = list.items.find(i => i.identifier === request.itemId);
      if (!item) {
        throw new Error(`Item with ID ${request.itemId} not found`);
      }
      
      // Update item properties
      if (request.name !== undefined) item.name = request.name;
      if (request.details !== undefined) item.details = request.details;
      if (request.quantity !== undefined) item.quantity = request.quantity;
      if (request.checked !== undefined) item.checked = request.checked;
      
      return item;
    });
    
    vi.spyOn(anylistService, 'removeItem').mockImplementation(async (listId, itemId) => {
      const list = mockLists.find(l => l.identifier === listId);
      if (!list) {
        throw new Error(`List with ID ${listId} not found`);
      }
      
      const itemIndex = list.items.findIndex(i => i.identifier === itemId);
      if (itemIndex === -1) {
        throw new Error(`Item with ID ${itemId} not found`);
      }
      
      // Mark as checked (simulating removal behavior)
      list.items[itemIndex].checked = true;
    });
    
    vi.spyOn(anylistService, 'uncheckAllItems').mockImplementation(async (listId) => {
      const list = mockLists.find(l => l.identifier === listId);
      if (!list) {
        throw new Error(`List with ID ${listId} not found`);
      }
      
      list.items.forEach(item => {
        item.checked = false;
      });
    });
    
    // Register tools
    registerListTools(mockServer, anylistService);
  });

  describe('get_lists tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_lists');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_lists');
    });

    it('should retrieve all lists with items', async () => {
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({ includeItems: true });
      
      expect(result.content[0].text).toContain('Found 2 lists');
      expect(result.content[0].text).toContain('Grocery List');
      expect(result.content[0].text).toContain('Shopping List');
      expect(result.content[0].text).toContain('Milk');
      expect(result.content[0].text).toContain('Shampoo');
    });

    it('should retrieve lists without items when includeItems is false', async () => {
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({ includeItems: false });
      
      expect(result.content[0].text).toContain('Found 2 lists');
      expect(result.content[0].text).toContain('Grocery List');
      expect(result.content[0].text).not.toContain('Milk');
    });

    it('should handle empty lists', async () => {
      vi.spyOn(anylistService, 'getLists').mockResolvedValue([]);
      
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Found 0 lists');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getLists').mockRejectedValue(new Error('API Error'));
      
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving lists: API Error');
    });
  });

  describe('add_item tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('add_item');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('add_item');
    });

    it('should add item to list successfully', async () => {
      const tool = mockServer.getTool('add_item');
      const result = await tool?.execute({
        listId: 'list-1',
        name: 'Apples',
        details: 'Red delicious',
        quantity: '6 count',
      });
      
      expect(result.content[0].text).toContain('Successfully added "Apples"');
      expect(result.content[0].text).toContain('quantity: 6 count');
      expect(result.content[0].text).toContain('Red delicious');
    });

    it('should add item without optional fields', async () => {
      const tool = mockServer.getTool('add_item');
      const result = await tool?.execute({
        listId: 'list-1',
        name: 'Bananas',
      });
      
      expect(result.content[0].text).toContain('Successfully added "Bananas"');
    });

    it('should handle invalid list ID', async () => {
      const tool = mockServer.getTool('add_item');
      const result = await tool?.execute({
        listId: 'invalid-list',
        name: 'Test Item',
      });
      
      expect(result.content[0].text).toContain('Error adding item');
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'addItem').mockRejectedValue(new Error('Network Error'));
      
      const tool = mockServer.getTool('add_item');
      const result = await tool?.execute({
        listId: 'list-1',
        name: 'Test Item',
      });
      
      expect(result.content[0].text).toContain('Error adding item: Network Error');
    });
  });

  describe('update_item tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('update_item');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('update_item');
    });

    it('should update item name', async () => {
      const tool = mockServer.getTool('update_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-1',
        name: 'Organic Milk',
      });
      
      expect(result.content[0].text).toContain('Successfully updated item "Organic Milk"');
      expect(result.content[0].text).toContain('name: "Organic Milk"');
    });

    it('should update item checked status', async () => {
      const tool = mockServer.getTool('update_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-1',
        checked: true,
      });
      
      expect(result.content[0].text).toContain('Successfully updated item');
      expect(result.content[0].text).toContain('status: checked');
    });

    it('should update multiple fields', async () => {
      const tool = mockServer.getTool('update_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-1',
        name: 'Organic Milk',
        quantity: '2 gallons',
        details: 'Lactose-free',
        checked: true,
      });
      
      expect(result.content[0].text).toContain('Successfully updated item "Organic Milk"');
      expect(result.content[0].text).toContain('name: "Organic Milk"');
      expect(result.content[0].text).toContain('quantity: 2 gallons');
      expect(result.content[0].text).toContain('details: "Lactose-free"');
      expect(result.content[0].text).toContain('status: checked');
    });

    it('should handle invalid list ID', async () => {
      const tool = mockServer.getTool('update_item');
      const result = await tool?.execute({
        listId: 'invalid-list',
        itemId: 'item-1',
        name: 'Updated Item',
      });
      
      expect(result.content[0].text).toContain('Error updating item');
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });

    it('should handle invalid item ID', async () => {
      const tool = mockServer.getTool('update_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'invalid-item',
        name: 'Updated Item',
      });
      
      expect(result.content[0].text).toContain('Error updating item');
      expect(result.content[0].text).toContain('Item with ID invalid-item not found');
    });
  });

  describe('remove_item tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('remove_item');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('remove_item');
    });

    it('should remove item successfully', async () => {
      const tool = mockServer.getTool('remove_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-1',
      });
      
      expect(result.content[0].text).toContain('Successfully removed item from list');
    });

    it('should handle invalid list ID', async () => {
      const tool = mockServer.getTool('remove_item');
      const result = await tool?.execute({
        listId: 'invalid-list',
        itemId: 'item-1',
      });
      
      expect(result.content[0].text).toContain('Error removing item');
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });

    it('should handle invalid item ID', async () => {
      const tool = mockServer.getTool('remove_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'invalid-item',
      });
      
      expect(result.content[0].text).toContain('Error removing item');
      expect(result.content[0].text).toContain('Item with ID invalid-item not found');
    });
  });

  describe('toggle_item tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('toggle_item');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('toggle_item');
    });

    it('should toggle item from unchecked to checked', async () => {
      const tool = mockServer.getTool('toggle_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-1', // Milk is unchecked
      });
      
      expect(result.content[0].text).toContain('Successfully checked "Milk"');
    });

    it('should toggle item from checked to unchecked', async () => {
      const tool = mockServer.getTool('toggle_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'item-2', // Bread is checked
      });
      
      expect(result.content[0].text).toContain('Successfully unchecked "Bread"');
    });

    it('should handle invalid list ID', async () => {
      const tool = mockServer.getTool('toggle_item');
      const result = await tool?.execute({
        listId: 'invalid-list',
        itemId: 'item-1',
      });
      
      expect(result.content[0].text).toContain('Error toggling item');
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });

    it('should handle invalid item ID', async () => {
      const tool = mockServer.getTool('toggle_item');
      const result = await tool?.execute({
        listId: 'list-1',
        itemId: 'invalid-item',
      });
      
      expect(result.content[0].text).toContain('Error toggling item');
      expect(result.content[0].text).toContain('Item with ID invalid-item not found');
    });
  });

  describe('uncheck_all_items tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('uncheck_all_items');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('uncheck_all_items');
    });

    it('should uncheck all items successfully', async () => {
      const tool = mockServer.getTool('uncheck_all_items');
      const result = await tool?.execute({
        listId: 'list-1',
      });
      
      expect(result.content[0].text).toContain('Successfully unchecked all items in the list');
    });

    it('should handle invalid list ID', async () => {
      const tool = mockServer.getTool('uncheck_all_items');
      const result = await tool?.execute({
        listId: 'invalid-list',
      });
      
      expect(result.content[0].text).toContain('Error unchecking all items');
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });
  });

  describe('get_list_details tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_list_details');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_list_details');
    });

    it('should get detailed list information', async () => {
      const tool = mockServer.getTool('get_list_details');
      const result = await tool?.execute({
        listId: 'list-1',
      });
      
      expect(result.content[0].text).toContain('**Grocery List**');
      expect(result.content[0].text).toContain('Total items: 2');
      expect(result.content[0].text).toContain('Checked items: 1');
      expect(result.content[0].text).toContain('Unchecked items: 1');
      expect(result.content[0].text).toContain('**Unchecked Items:**');
      expect(result.content[0].text).toContain('**Checked Items:**');
      expect(result.content[0].text).toContain('- Milk (1 gallon) - 2% fat');
      expect(result.content[0].text).toContain('- ✓ Bread (1 loaf) - Whole wheat');
    });

    it('should handle list not found', async () => {
      const tool = mockServer.getTool('get_list_details');
      const result = await tool?.execute({
        listId: 'invalid-list',
      });
      
      expect(result.content[0].text).toContain('List with ID invalid-list not found');
    });

    it('should handle empty list', async () => {
      // Add empty list to mock data
      mockLists.push({
        identifier: 'empty-list',
        parentId: null,
        name: 'Empty List',
        items: [],
      });
      
      const tool = mockServer.getTool('get_list_details');
      const result = await tool?.execute({
        listId: 'empty-list',
      });
      
      expect(result.content[0].text).toContain('**Empty List**');
      expect(result.content[0].text).toContain('Total items: 0');
      expect(result.content[0].text).toContain('Checked items: 0');
      expect(result.content[0].text).toContain('Unchecked items: 0');
    });
  });

  describe('Bulk Operations', () => {
    describe('bulk_add_items tool', () => {
      it('should be registered', () => {
        const tool = mockServer.getTool('bulk_add_items');
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('bulk_add_items');
      });

      it('should add multiple items successfully', async () => {
        const tool = mockServer.getTool('bulk_add_items');
        const result = await tool?.execute({
          listId: 'list-1',
          items: [
            { name: 'Apples', quantity: '6 count', details: 'Red delicious' },
            { name: 'Bananas', quantity: '1 bunch' },
            { name: 'Oranges' },
          ],
        });
        
        expect(result.content[0].text).toContain('Bulk add completed: 3 successful, 0 failed');
        expect(result.content[0].text).toContain('✓ Added "Apples"');
        expect(result.content[0].text).toContain('✓ Added "Bananas"');
        expect(result.content[0].text).toContain('✓ Added "Oranges"');
      });

      it('should handle partial failures', async () => {
        // Mock one failure
        let callCount = 0;
        vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Network timeout');
          }
          
          const list = mockLists.find(l => l.identifier === request.listId);
          if (!list) {
            throw new Error(`List with ID ${request.listId} not found`);
          }
          
          const newItem = {
            listId: request.listId,
            identifier: `item-${Date.now()}-${callCount}`,
            name: request.name,
            details: request.details,
            quantity: request.quantity,
            checked: false,
            manualSortIndex: list.items.length,
            userId: 'user-1',
            categoryMatchId: 'category-1',
          };
          
          return newItem;
        });
        
        const tool = mockServer.getTool('bulk_add_items');
        const result = await tool?.execute({
          listId: 'list-1',
          items: [
            { name: 'Apples' },
            { name: 'Bananas' },
            { name: 'Oranges' },
          ],
        });
        
        expect(result.content[0].text).toContain('Bulk add completed: 2 successful, 1 failed');
        expect(result.content[0].text).toContain('✓ Added "Apples"');
        expect(result.content[0].text).toContain('✗ Failed to add "Bananas": Network timeout');
        expect(result.content[0].text).toContain('✓ Added "Oranges"');
      });

      it('should handle invalid list ID', async () => {
        const tool = mockServer.getTool('bulk_add_items');
        const result = await tool?.execute({
          listId: 'invalid-list',
          items: [{ name: 'Test Item' }],
        });
        
        expect(result.content[0].text).toContain('Bulk add completed: 0 successful, 1 failed');
        expect(result.content[0].text).toContain('✗ Failed to add "Test Item"');
      });
    });

    describe('bulk_update_items tool', () => {
      it('should be registered', () => {
        const tool = mockServer.getTool('bulk_update_items');
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('bulk_update_items');
      });

      it('should update multiple items successfully', async () => {
        const tool = mockServer.getTool('bulk_update_items');
        const result = await tool?.execute({
          listId: 'list-1',
          updates: [
            { itemId: 'item-1', name: 'Organic Milk', checked: true },
            { itemId: 'item-2', quantity: '2 loaves' },
          ],
        });
        
        expect(result.content[0].text).toContain('Bulk update completed: 2 successful, 0 failed');
        expect(result.content[0].text).toContain('✓ Updated "Organic Milk"');
        expect(result.content[0].text).toContain('✓ Updated "Bread"');
      });

      it('should handle partial failures', async () => {
        let callCount = 0;
        vi.spyOn(anylistService, 'updateItem').mockImplementation(async (request) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Update failed');
          }
          
          const list = mockLists.find(l => l.identifier === request.listId);
          if (!list) {
            throw new Error(`List with ID ${request.listId} not found`);
          }
          
          const item = list.items.find(i => i.identifier === request.itemId);
          if (!item) {
            throw new Error(`Item with ID ${request.itemId} not found`);
          }
          
          if (request.name !== undefined) item.name = request.name;
          return item;
        });
        
        const tool = mockServer.getTool('bulk_update_items');
        const result = await tool?.execute({
          listId: 'list-1',
          updates: [
            { itemId: 'item-1', name: 'Updated Milk' },
            { itemId: 'item-2', name: 'Updated Bread' },
          ],
        });
        
        expect(result.content[0].text).toContain('Bulk update completed: 1 successful, 1 failed');
        expect(result.content[0].text).toContain('✓ Updated "Updated Milk"');
        expect(result.content[0].text).toContain('✗ Failed to update item item-2: Update failed');
      });
    });

    describe('bulk_remove_items tool', () => {
      it('should be registered', () => {
        const tool = mockServer.getTool('bulk_remove_items');
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('bulk_remove_items');
      });

      it('should remove multiple items successfully', async () => {
        const tool = mockServer.getTool('bulk_remove_items');
        const result = await tool?.execute({
          listId: 'list-1',
          itemIds: ['item-1', 'item-2'],
        });
        
        expect(result.content[0].text).toContain('Bulk remove completed: 2 successful, 0 failed');
        expect(result.content[0].text).toContain('✓ Removed item item-1');
        expect(result.content[0].text).toContain('✓ Removed item item-2');
      });

      it('should handle partial failures', async () => {
        let callCount = 0;
        vi.spyOn(anylistService, 'removeItem').mockImplementation(async (listId, itemId) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Remove failed');
          }
          
          const list = mockLists.find(l => l.identifier === listId);
          if (!list) {
            throw new Error(`List with ID ${listId} not found`);
          }
          
          const itemIndex = list.items.findIndex(i => i.identifier === itemId);
          if (itemIndex === -1) {
            throw new Error(`Item with ID ${itemId} not found`);
          }
        });
        
        const tool = mockServer.getTool('bulk_remove_items');
        const result = await tool?.execute({
          listId: 'list-1',
          itemIds: ['item-1', 'item-2'],
        });
        
        expect(result.content[0].text).toContain('Bulk remove completed: 1 successful, 1 failed');
        expect(result.content[0].text).toContain('✓ Removed item item-1');
        expect(result.content[0].text).toContain('✗ Failed to remove item item-2: Remove failed');
      });
    });

    describe('bulk_toggle_items tool', () => {
      it('should be registered', () => {
        const tool = mockServer.getTool('bulk_toggle_items');
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('bulk_toggle_items');
      });

      it('should toggle multiple items successfully', async () => {
        const tool = mockServer.getTool('bulk_toggle_items');
        const result = await tool?.execute({
          listId: 'list-1',
          itemIds: ['item-1', 'item-2'],
        });
        
        expect(result.content[0].text).toContain('Bulk toggle completed: 2 successful, 0 failed');
        expect(result.content[0].text).toContain('✓ Checked "Milk"'); // Was unchecked
        expect(result.content[0].text).toContain('✓ Unchecked "Bread"'); // Was checked
      });

      it('should handle invalid list ID', async () => {
        const tool = mockServer.getTool('bulk_toggle_items');
        const result = await tool?.execute({
          listId: 'invalid-list',
          itemIds: ['item-1'],
        });
        
        expect(result.content[0].text).toContain('Error in bulk toggle operation');
        expect(result.content[0].text).toContain('List with ID invalid-list not found');
      });

      it('should handle invalid item ID', async () => {
        const tool = mockServer.getTool('bulk_toggle_items');
        const result = await tool?.execute({
          listId: 'list-1',
          itemIds: ['invalid-item'],
        });
        
        expect(result.content[0].text).toContain('Bulk toggle completed: 0 successful, 1 failed');
        expect(result.content[0].text).toContain('✗ Failed to toggle item invalid-item');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service connection errors', async () => {
      vi.spyOn(anylistService, 'getLists').mockRejectedValue(new Error('Connection failed'));
      
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving lists: Connection failed');
    });

    it('should handle unknown errors', async () => {
      vi.spyOn(anylistService, 'getLists').mockRejectedValue('Unknown error type');
      
      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving lists: Unknown error');
    });

    it('should handle null responses gracefully', async () => {
      vi.spyOn(anylistService, 'getLists').mockResolvedValue(null as any);

      const tool = mockServer.getTool('get_lists');
      const result = await tool?.execute({});

      // get_lists has try/catch, so errors are returned as text content
      expect(result.content[0].text).toContain('Error retrieving lists:');
    });
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', () => {
      const expectedTools = [
        'get_lists',
        'create_list',
        'add_item',
        'update_item',
        'remove_item',
        'toggle_item',
        'uncheck_all_items',
        'bulk_add_items',
        'bulk_update_items',
        'bulk_remove_items',
        'bulk_toggle_items',
        'get_list_details',
      ];
      
      const registeredTools = mockServer.getAllTools().map(tool => tool.name);
      
      for (const expectedTool of expectedTools) {
        expect(registeredTools).toContain(expectedTool);
      }
    });

    it('should have proper tool descriptions', () => {
      const tools = mockServer.getAllTools();
      
      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
        expect(tool.parameters).toBeDefined();
      }
    });
  });
});