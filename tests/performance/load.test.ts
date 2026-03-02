import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnyListService } from '../../src/services/anylist-service.js';
import { registerListTools } from '../../src/tools/list-tools.js';
import { registerRecipeTools } from '../../src/tools/recipe-tools.js';
import { registerMealTools } from '../../src/tools/meal-tools.js';
import { createMockFastMCP } from '../mocks/fastmcp-mock.js';
import { mockLists, mockRecipes, mockMealEvents, resetMockData } from '../mocks/anylist-mock.js';
import type { AnyListConfig } from '../../src/types/index.js';

// Mock the AnyList module
vi.mock('anylist', () => ({
  default: vi.fn(() => ({
    login: vi.fn(),
    getLists: vi.fn().mockResolvedValue(mockLists),
    getRecipes: vi.fn().mockResolvedValue(mockRecipes),
    getMealPlanningCalendarEvents: vi.fn().mockResolvedValue(mockMealEvents),
    lists: mockLists,
    recipes: mockRecipes,
    mealPlanningCalendarEvents: mockMealEvents,
    teardown: vi.fn(),
  })),
}));

describe('Performance and Load Tests', () => {
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
    
    // Setup service mocks for performance testing
    setupPerformanceMocks();
    
    // Register all tools
    registerListTools(mockServer, anylistService);
    registerRecipeTools(mockServer, anylistService);
    registerMealTools(mockServer, anylistService);
  });

  function setupPerformanceMocks() {
    // Mock service methods with realistic delays for performance testing
    vi.spyOn(anylistService, 'getLists').mockImplementation(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));
      return mockLists;
    });
    
    vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const list = mockLists.find(l => l.identifier === request.listId);
      if (!list) throw new Error(`List with ID ${request.listId} not found`);
      
      const newItem = {
        listId: request.listId,
        identifier: `item-${Date.now()}-${Math.random()}`,
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
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const list = mockLists.find(l => l.identifier === request.listId);
      if (!list) throw new Error(`List with ID ${request.listId} not found`);
      
      const item = list.items.find(i => i.identifier === request.itemId);
      if (!item) throw new Error(`Item with ID ${request.itemId} not found`);
      
      if (request.name !== undefined) item.name = request.name;
      if (request.details !== undefined) item.details = request.details;
      if (request.quantity !== undefined) item.quantity = request.quantity;
      if (request.checked !== undefined) item.checked = request.checked;
      
      return item;
    });
    
    vi.spyOn(anylistService, 'getRecipes').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return mockRecipes;
    });
    
    vi.spyOn(anylistService, 'createRecipe').mockImplementation(async (request) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const newRecipe = {
        identifier: `recipe-${Date.now()}-${Math.random()}`,
        timestamp: Date.now() / 1000,
        name: request.name,
        note: request.note,
        sourceName: request.sourceName,
        sourceUrl: request.sourceUrl,
        ingredients: request.ingredients || [],
        preparationSteps: request.preparationSteps || [],
        instructions: request.preparationSteps || [],
        photoIds: [],
        adCampaignId: undefined,
        photoUrls: [],
        scaleFactor: request.scaleFactor || 1,
        rating: request.rating,
        creationTimestamp: Date.now() / 1000,
        nutritionalInfo: request.nutritionalInfo,
        cookTime: request.cookTime,
        prepTime: request.prepTime,
        servings: request.servings,
        paprikaIdentifier: undefined,
      };
      
      mockRecipes.push(newRecipe);
      return newRecipe;
    });
  }

  describe('Bulk Operations Performance', () => {
    it('should handle bulk add operations within reasonable time', async () => {
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const startTime = Date.now();
      
      // Add 100 items
      const items = Array.from({ length: 100 }, (_, i) => ({
        name: `Performance Test Item ${i + 1}`,
        quantity: `${i + 1} units`,
        details: `Test item for performance testing`,
      }));
      
      const result = await bulkAdd?.execute({
        listId: 'list-1',
        items,
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('100 successful, 0 failed');
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`Bulk add of 100 items completed in ${duration}ms`);
    });

    it('should handle bulk update operations efficiently', async () => {
      // First add items to update
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const items = Array.from({ length: 50 }, (_, i) => ({
        name: `Update Test Item ${i + 1}`,
        quantity: `${i + 1} units`,
      }));
      
      await bulkAdd?.execute({
        listId: 'list-1',
        items,
      });
      
      // Now test bulk update performance
      const bulkUpdate = mockServer.getTool('bulk_update_items');
      const startTime = Date.now();
      
      const currentItems = mockLists[0].items;
      const updates = currentItems.map(item => ({
        itemId: item.identifier,
        details: `Updated at ${new Date().toISOString()}`,
        checked: Math.random() > 0.5,
      }));
      
      const result = await bulkUpdate?.execute({
        listId: 'list-1',
        updates,
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('successful');
      expect(duration).toBeLessThan(1500); // Should complete within 1.5 seconds
      
      console.log(`Bulk update of ${currentItems.length} items completed in ${duration}ms`);
    });

    it('should handle bulk toggle operations at scale', async () => {
      // Add items for testing
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const items = Array.from({ length: 200 }, (_, i) => ({
        name: `Toggle Test Item ${i + 1}`,
      }));
      
      await bulkAdd?.execute({
        listId: 'list-1',
        items,
      });
      
      // Test bulk toggle performance
      const bulkToggle = mockServer.getTool('bulk_toggle_items');
      const startTime = Date.now();
      
      const currentItems = mockLists[0].items;
      const result = await bulkToggle?.execute({
        listId: 'list-1',
        itemIds: currentItems.map(item => item.identifier),
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('successful');
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
      
      console.log(`Bulk toggle of ${currentItems.length} items completed in ${duration}ms`);
    });
  });

  describe('Recipe Search Performance', () => {
    it('should handle large recipe collections efficiently', async () => {
      // Add many recipes for testing
      const createRecipe = mockServer.getTool('create_recipe');
      
      const recipes = Array.from({ length: 50 }, (_, i) => ({
        name: `Performance Recipe ${i + 1}`,
        note: `Test recipe number ${i + 1} for performance testing`,
        ingredients: [
          { rawIngredient: `${i + 1} cups flour`, name: 'Flour', quantity: `${i + 1} cups` },
          { rawIngredient: '2 eggs', name: 'Eggs', quantity: '2' },
        ],
        preparationSteps: [
          'Mix ingredients',
          'Cook according to directions',
        ],
        rating: (i % 5) + 1, // Ratings 1-5
      }));
      
      // Create recipes (this will take some time due to mock delays)
      for (const recipe of recipes.slice(0, 10)) { // Create 10 for testing
        await createRecipe?.execute(recipe);
      }
      
      // Test search performance
      const searchRecipes = mockServer.getTool('search_recipes');
      const startTime = Date.now();
      
      const result = await searchRecipes?.execute({
        query: 'recipe',
        minRating: 3,
        maxCookTime: 3600,
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('recipes matching your criteria');
      expect(duration).toBeLessThan(500); // Search should be very fast
      
      console.log(`Recipe search completed in ${duration}ms`);
    });

    it('should handle recipe retrieval with large ingredient lists', async () => {
      // Create recipe with many ingredients
      const createRecipe = mockServer.getTool('create_recipe');
      const manyIngredients = Array.from({ length: 30 }, (_, i) => ({
        rawIngredient: `Ingredient ${i + 1}`,
        name: `Ingredient ${i + 1}`,
        quantity: `${i + 1} units`,
      }));
      
      await createRecipe?.execute({
        name: 'Complex Recipe',
        ingredients: manyIngredients,
        preparationSteps: Array.from({ length: 15 }, (_, i) => `Step ${i + 1}`),
      });
      
      // Test retrieval performance
      const getRecipes = mockServer.getTool('get_recipes');
      const startTime = Date.now();
      
      const result = await getRecipes?.execute({
        includeDetails: true,
        searchTerm: 'Complex',
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('Complex Recipe');
      expect(duration).toBeLessThan(200); // Should be fast even with complex recipes
      
      console.log(`Complex recipe retrieval completed in ${duration}ms`);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous operations', async () => {
      const startTime = Date.now();
      
      // Execute multiple operations concurrently
      const operations = [
        mockServer.getTool('get_lists')?.execute({}),
        mockServer.getTool('get_recipes')?.execute({}),
        mockServer.getTool('get_meal_events')?.execute({}),
        mockServer.getTool('add_item')?.execute({
          listId: 'list-1',
          name: 'Concurrent Item 1',
        }),
        mockServer.getTool('add_item')?.execute({
          listId: 'list-1',
          name: 'Concurrent Item 2',
        }),
        mockServer.getTool('add_item')?.execute({
          listId: 'list-2',
          name: 'Concurrent Item 3',
        }),
      ];
      
      const results = await Promise.all(operations.filter(Boolean));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(6);
      expect(duration).toBeLessThan(100); // Concurrent operations should be much faster
      
      console.log(`6 concurrent operations completed in ${duration}ms`);
    });

    it('should handle mixed bulk and individual operations', async () => {
      const startTime = Date.now();
      
      // Mix of bulk and individual operations
      const operations = [
        // Bulk operations
        mockServer.getTool('bulk_add_items')?.execute({
          listId: 'list-1',
          items: Array.from({ length: 20 }, (_, i) => ({ name: `Bulk Item ${i + 1}` })),
        }),
        
        // Individual operations
        ...Array.from({ length: 10 }, (_, i) => 
          mockServer.getTool('add_item')?.execute({
            listId: 'list-2',
            name: `Individual Item ${i + 1}`,
          })
        ),
        
        // Read operations
        mockServer.getTool('get_lists')?.execute({}),
        mockServer.getTool('get_recipes')?.execute({}),
      ];
      
      const results = await Promise.all(operations.filter(Boolean));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(13); // 1 bulk + 10 individual + 2 read
      expect(duration).toBeLessThan(800); // Should complete reasonably fast
      
      console.log(`Mixed operations (1 bulk + 10 individual + 2 read) completed in ${duration}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large data sets without memory issues', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create large dataset
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const largeItemSet = Array.from({ length: 1000 }, (_, i) => ({
        name: `Memory Test Item ${i + 1}`,
        details: `This is a test item with some details to simulate real data usage. Item number ${i + 1}.`,
        quantity: `${(i % 10) + 1} units`,
      }));
      
      await bulkAdd?.execute({
        listId: 'list-1',
        items: largeItemSet,
      });
      
      // Perform various operations on the large dataset
      const getListDetails = mockServer.getTool('get_list_details');
      await getListDetails?.execute({ listId: 'list-1' });
      
      const bulkUpdate = mockServer.getTool('bulk_update_items');
      const items = mockLists[0].items;
      await bulkUpdate?.execute({
        listId: 'list-1',
        updates: items.slice(0, 500).map(item => ({
          itemId: item.identifier,
          checked: true,
        })),
      });
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final heap usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should clean up resources properly after operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await mockServer.getTool('add_item')?.execute({
          listId: 'list-1',
          name: `Cleanup Test Item ${i + 1}`,
        });
        
        if (i % 10 === 0) {
          await mockServer.getTool('get_lists')?.execute({});
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      
      console.log(`Memory increase after cleanup: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover quickly from failed operations', async () => {
      // Set up some operations to fail
      let failureCount = 0;
      vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
        failureCount++;
        if (failureCount % 3 === 0) {
          throw new Error('Simulated failure');
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
        
        const list = mockLists.find(l => l.identifier === request.listId);
        if (!list) throw new Error(`List with ID ${request.listId} not found`);
        
        return {
          listId: request.listId,
          identifier: `item-${Date.now()}-${Math.random()}`,
          name: request.name,
          details: request.details,
          quantity: request.quantity,
          checked: false,
          manualSortIndex: list.items.length,
          userId: 'user-1',
          categoryMatchId: 'category-1',
        };
      });
      
      const startTime = Date.now();
      
      // Execute bulk operation with some failures
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const result = await bulkAdd?.execute({
        listId: 'list-1',
        items: Array.from({ length: 30 }, (_, i) => ({
          name: `Error Recovery Item ${i + 1}`,
        })),
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle partial failures gracefully
      expect(result.content[0].text).toContain('successful');
      expect(result.content[0].text).toContain('failed');
      expect(duration).toBeLessThan(1000); // Should still complete quickly
      
      console.log(`Error recovery test completed in ${duration}ms`);
      console.log(`Result: ${result.content[0].text.split('\n')[0]}`);
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle rate-limited operations gracefully', async () => {
      // Simulate rate limiting by adding delays
      let operationCount = 0;
      vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
        operationCount++;
        
        // Simulate rate limiting: every 10th operation takes longer
        if (operationCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay
        } else {
          await new Promise(resolve => setTimeout(resolve, 5)); // Normal delay
        }
        
        const list = mockLists.find(l => l.identifier === request.listId);
        if (!list) throw new Error(`List with ID ${request.listId} not found`);
        
        return {
          listId: request.listId,
          identifier: `item-${Date.now()}-${Math.random()}`,
          name: request.name,
          details: request.details,
          quantity: request.quantity,
          checked: false,
          manualSortIndex: list.items.length,
          userId: 'user-1',
          categoryMatchId: 'category-1',
        };
      });
      
      const startTime = Date.now();
      
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const result = await bulkAdd?.execute({
        listId: 'list-1',
        items: Array.from({ length: 25 }, (_, i) => ({
          name: `Rate Limited Item ${i + 1}`,
        })),
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.content[0].text).toContain('25 successful, 0 failed');
      // Should take longer due to rate limiting but still complete
      expect(duration).toBeGreaterThan(200); // At least some delay from rate limiting
      expect(duration).toBeLessThan(2000); // But not excessively long
      
      console.log(`Rate limiting test completed in ${duration}ms`);
    });
  });
});