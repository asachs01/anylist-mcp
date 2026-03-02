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
    getLists: vi.fn(),
    getRecipes: vi.fn(),
    getMealPlanningCalendarEvents: vi.fn(),
    lists: mockLists,
    recipes: mockRecipes,
    mealPlanningCalendarEvents: mockMealEvents,
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
    createRecipe: vi.fn(async (data) => {
      const recipe = {
        ...data,
        identifier: `recipe-${Date.now()}`,
        timestamp: Date.now() / 1000,
        save: vi.fn(async function() {
          mockRecipes.push(this);
          return this;
        }),
        delete: vi.fn(async () => {}),
      };
      return recipe;
    }),
    createEvent: vi.fn(async (data) => {
      const event = {
        ...data,
        identifier: `meal-${Date.now()}`,
        calendarId: 'calendar-1',
        logicalTimestamp: Date.now(),
        orderAddedSortIndex: mockMealEvents.length,
        save: vi.fn(async function() {
          mockMealEvents.push(this);
          return this;
        }),
        delete: vi.fn(async () => {}),
      };
      return event;
    }),
    teardown: vi.fn(),
  })),
}));

describe('Integration Workflows', () => {
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
    
    // Mock all service methods for consistent behavior
    setupServiceMocks();
    
    // Register all tools
    registerListTools(mockServer, anylistService);
    registerRecipeTools(mockServer, anylistService);
    registerMealTools(mockServer, anylistService);
  });

  function setupServiceMocks() {
    // List management mocks
    vi.spyOn(anylistService, 'getLists').mockResolvedValue(mockLists);
    vi.spyOn(anylistService, 'addItem').mockImplementation(async (request) => {
      const list = mockLists.find(l => l.identifier === request.listId);
      if (!list) throw new Error(`List with ID ${request.listId} not found`);
      
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
      if (!list) throw new Error(`List with ID ${request.listId} not found`);
      
      const item = list.items.find(i => i.identifier === request.itemId);
      if (!item) throw new Error(`Item with ID ${request.itemId} not found`);
      
      if (request.name !== undefined) item.name = request.name;
      if (request.details !== undefined) item.details = request.details;
      if (request.quantity !== undefined) item.quantity = request.quantity;
      if (request.checked !== undefined) item.checked = request.checked;
      
      return item;
    });

    // Recipe management mocks
    vi.spyOn(anylistService, 'getRecipes').mockResolvedValue(mockRecipes);
    vi.spyOn(anylistService, 'getRecipe').mockImplementation(async (recipeId) => {
      const recipe = mockRecipes.find(r => r.identifier === recipeId);
      if (!recipe) throw new Error(`Recipe with ID ${recipeId} not found`);
      return recipe;
    });
    
    vi.spyOn(anylistService, 'createRecipe').mockImplementation(async (request) => {
      const newRecipe = {
        identifier: `recipe-${Date.now()}`,
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

    vi.spyOn(anylistService, 'removeItem').mockImplementation(async (listId, itemId) => {
      const list = mockLists.find(l => l.identifier === listId);
      if (!list) throw new Error(`List with ID ${listId} not found`);
      const index = list.items.findIndex(i => i.identifier === itemId);
      if (index === -1) throw new Error(`Item with ID ${itemId} not found`);
      list.items.splice(index, 1);
    });

    vi.spyOn(anylistService, 'uncheckAllItems').mockImplementation(async (listId) => {
      const list = mockLists.find(l => l.identifier === listId);
      if (!list) throw new Error(`List with ID ${listId} not found`);
      list.items.forEach(item => { item.checked = false; });
    });

    vi.spyOn(anylistService, 'importRecipeFromUrl').mockImplementation(async (request) => {
      const importedRecipe = {
        identifier: `recipe-imported-${Date.now()}`,
        timestamp: Date.now() / 1000,
        name: request.name || 'Imported Recipe',
        note: 'Imported from URL',
        sourceName: new URL(request.url).hostname,
        sourceUrl: request.url,
        ingredients: [
          { rawIngredient: '1 lb ground beef', name: 'Ground beef', quantity: '1 lb' },
          { rawIngredient: '1 box lasagna noodles', name: 'Lasagna noodles', quantity: '1 box' },
        ],
        preparationSteps: ['Cook noodles', 'Layer ingredients'],
        instructions: ['Cook noodles', 'Layer ingredients'],
        photoIds: [],
        adCampaignId: undefined,
        photoUrls: [],
        scaleFactor: 1,
        rating: undefined,
        creationTimestamp: Date.now() / 1000,
        nutritionalInfo: undefined,
        cookTime: 2700,
        prepTime: 1800,
        servings: '8 servings',
        paprikaIdentifier: undefined,
      };
      mockRecipes.push(importedRecipe);
      return importedRecipe;
    });

    // Meal planning mocks
    vi.spyOn(anylistService, 'getMealEvents').mockImplementation(async (startDate?, endDate?) => {
      let filteredEvents = [...mockMealEvents];
      
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        filteredEvents = mockMealEvents.filter((event) => {
          const eventDate = new Date(event.date);
          if (start && eventDate < start) return false;
          if (end && eventDate > end) return false;
          return true;
        });
      }
      
      return filteredEvents;
    });
    
    vi.spyOn(anylistService, 'createMealEvent').mockImplementation(async (request) => {
      const newEvent = {
        identifier: `meal-${Date.now()}`,
        calendarId: 'calendar-1',
        date: new Date(request.date),
        details: request.details,
        labelId: 'label-1',
        label: 'Meal',
        logicalTimestamp: Date.now(),
        orderAddedSortIndex: mockMealEvents.length,
        recipeId: request.recipeId,
        recipe: request.recipeId ? mockRecipes.find(r => r.identifier === request.recipeId) : undefined,
        recipeScaleFactor: request.recipeScaleFactor || 1,
        title: request.title,
      };
      mockMealEvents.push(newEvent);
      return newEvent;
    });
  }

  describe('Complete Grocery Shopping Workflow', () => {
    it('should execute a complete grocery shopping workflow', async () => {
      // 1. Get current lists
      let getLists = mockServer.getTool('get_lists');
      let result = await getLists?.execute({ includeItems: true });
      expect(result.content[0].text).toContain('Found 2 lists');
      
      // 2. Get details of grocery list
      const getListDetails = mockServer.getTool('get_list_details');
      result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('**Grocery List**');
      expect(result.content[0].text).toContain('Total items: 2');
      
      // 3. Add multiple items to grocery list
      const bulkAdd = mockServer.getTool('bulk_add_items');
      result = await bulkAdd?.execute({
        listId: 'list-1',
        items: [
          { name: 'Apples', quantity: '6 count', details: 'Red delicious' },
          { name: 'Bananas', quantity: '1 bunch' },
          { name: 'Spinach', details: 'Fresh baby spinach' },
        ],
      });
      expect(result.content[0].text).toContain('Bulk add completed: 3 successful, 0 failed');
      
      // 4. Check updated list
      result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Total items: 5'); // 2 original + 3 new
      expect(result.content[0].text).toContain('Apples');
      expect(result.content[0].text).toContain('Bananas');
      expect(result.content[0].text).toContain('Spinach');
      
      // 5. Check off items as shopping
      const toggleItem = mockServer.getTool('toggle_item');
      await toggleItem?.execute({ listId: 'list-1', itemId: 'item-1' }); // Milk
      
      const bulkToggle = mockServer.getTool('bulk_toggle_items');
      result = await bulkToggle?.execute({
        listId: 'list-1',
        itemIds: mockLists[0].items.slice(-2).map(item => item.identifier), // Last 2 items
      });
      expect(result.content[0].text).toContain('Bulk toggle completed');
      
      // 6. Final list state
      result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Checked items:');
    });
  });

  describe('Recipe Creation and Meal Planning Workflow', () => {
    it('should create recipe and plan meals', async () => {
      // 1. Create a new recipe
      const createRecipe = mockServer.getTool('create_recipe');
      let result = await createRecipe?.execute({
        name: 'Chicken Stir Fry',
        note: 'Quick weeknight dinner',
        ingredients: [
          { rawIngredient: '1 lb chicken breast', name: 'Chicken breast', quantity: '1 lb' },
          { rawIngredient: '2 cups mixed vegetables', name: 'Mixed vegetables', quantity: '2 cups' },
          { rawIngredient: '3 tbsp soy sauce', name: 'Soy sauce', quantity: '3 tbsp' },
        ],
        preparationSteps: [
          'Cut chicken into strips',
          'Heat oil in wok',
          'Cook chicken until done',
          'Add vegetables and stir fry',
          'Add soy sauce and serve',
        ],
        cookTime: 900, // 15 minutes
        prepTime: 600, // 10 minutes
        servings: '4',
        rating: 5,
      });
      
      expect(result.content[0].text).toContain('Successfully created recipe "Chicken Stir Fry"');
      
      // 2. Verify recipe was created
      const getRecipes = mockServer.getTool('get_recipes');
      result = await getRecipes?.execute({ includeDetails: false });
      expect(result.content[0].text).toContain('Found 3 recipes'); // 2 original + 1 new
      expect(result.content[0].text).toContain('Chicken Stir Fry');
      
      // 3. Search for the new recipe by ingredient
      const searchRecipes = mockServer.getTool('search_recipes_by_ingredients');
      result = await searchRecipes?.execute({
        ingredients: ['chicken'],
        matchAll: false,
      });
      expect(result.content[0].text).toContain('Chicken Stir Fry');

      // 4. Create meal event using the new recipe
      const createMeal = mockServer.getTool('create_meal_event');
      const newRecipeId = mockRecipes[mockRecipes.length - 1].identifier;
      result = await createMeal?.execute({
        title: 'Weeknight Dinner',
        date: '2024-01-25',
        details: 'Family dinner',
        recipeId: newRecipeId,
        recipeScaleFactor: 1,
      });

      expect(result.content[0].text).toContain('Successfully created meal event "Weeknight Dinner"');
      expect(result.content[0].text).toContain('2024-01-25');

      // 5. Get weekly meal plan
      const getWeekly = mockServer.getTool('get_weekly_meal_plan');
      result = await getWeekly?.execute({
        startDate: '2024-01-22', // Monday of that week
      });

      expect(result.content[0].text).toContain('Weekly meal plan');
      expect(result.content[0].text).toContain('Weeknight Dinner');
    });
  });

  describe('Recipe Import and Shopping List Generation Workflow', () => {
    it('should import recipe and generate shopping list', async () => {
      // Mock fetch for recipe import
      global.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve(`
          <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Imported Lasagna",
              "description": "Classic Italian lasagna",
              "recipeIngredient": [
                "1 lb ground beef",
                "1 box lasagna noodles", 
                "2 cups ricotta cheese",
                "1 jar marinara sauce"
              ],
              "recipeInstructions": [
                {"text": "Cook noodles according to package"},
                {"text": "Brown ground beef"},
                {"text": "Layer ingredients in baking dish"},
                {"text": "Bake at 375F for 45 minutes"}
              ],
              "prepTime": "PT30M",
              "cookTime": "PT45M",
              "recipeYield": "8 servings"
            }
          </script>
        `),
      });
      
      // 1. Import recipe from URL
      const importRecipe = mockServer.getTool('import_recipe_from_url');
      let result = await importRecipe?.execute({
        url: 'https://example.com/lasagna-recipe',
      });

      expect(result.content[0].text).toContain('Successfully imported recipe');
      expect(result.content[0].text).toContain('Ingredients:');

      // 2. Get the imported recipe details
      const getRecipe = mockServer.getTool('get_recipe');
      const importedRecipeId = mockRecipes[mockRecipes.length - 1].identifier;
      result = await getRecipe?.execute({ recipeId: importedRecipeId });

      expect(result.content[0].text).toContain('# ');

      // 3. Create shopping list items based on recipe ingredients
      const addItem = mockServer.getTool('add_item');
      const recipe = mockRecipes[mockRecipes.length - 1];

      for (const ingredient of recipe.ingredients) {
        await addItem?.execute({
          listId: 'list-1',
          name: ingredient.name,
          quantity: ingredient.quantity,
          details: `For ${recipe.name}`,
        });
      }

      // 4. Verify shopping list was updated
      const getListDetails = mockServer.getTool('get_list_details');
      result = await getListDetails?.execute({ listId: 'list-1' });

      expect(result.content[0].text).toContain('Total items:');

      // 5. Plan meal with imported recipe
      const createMeal = mockServer.getTool('create_meal_event');
      result = await createMeal?.execute({
        title: 'Sunday Family Dinner',
        date: '2024-01-28',
        details: 'Special family meal',
        recipeId: importedRecipeId,
        recipeScaleFactor: 1.5,
      });

      expect(result.content[0].text).toContain('Successfully created meal event "Sunday Family Dinner"');
      expect(result.content[0].text).toContain('2024-01-28');
    });
  });

  describe('Bulk Operations and List Management Workflow', () => {
    it('should perform complex bulk operations', async () => {
      // 1. Start with current state
      const getListDetails = mockServer.getTool('get_list_details');
      let result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Total items: 2');
      
      // 2. Bulk add weekly groceries
      const bulkAdd = mockServer.getTool('bulk_add_items');
      result = await bulkAdd?.execute({
        listId: 'list-1',
        items: [
          { name: 'Apples', quantity: '3 lbs', details: 'Gala or Honeycrisp' },
          { name: 'Bananas', quantity: '2 bunches' },
          { name: 'Ground Turkey', quantity: '2 lbs', details: '93/7 lean' },
          { name: 'Pasta', quantity: '2 boxes', details: 'Whole wheat' },
          { name: 'Tomato Sauce', quantity: '3 cans' },
          { name: 'Greek Yogurt', quantity: '1 large container' },
          { name: 'Eggs', quantity: '1 dozen', details: 'Free range' },
        ],
      });
      expect(result.content[0].text).toContain('Bulk add completed: 7 successful, 0 failed');
      
      // 3. Update some items with more specific details
      const bulkUpdate = mockServer.getTool('bulk_update_items');
      const currentItems = mockLists[0].items;
      const itemsToUpdate = currentItems.slice(-3).map(item => ({
        itemId: item.identifier,
        details: item.details ? `${item.details} - On sale this week` : 'On sale this week',
      }));
      
      result = await bulkUpdate?.execute({
        listId: 'list-1',
        updates: itemsToUpdate,
      });
      expect(result.content[0].text).toContain('Bulk update completed');
      
      // 4. Simulate shopping trip - check off items as purchased
      const firstHalfItems = currentItems.slice(0, Math.ceil(currentItems.length / 2));
      const bulkToggle = mockServer.getTool('bulk_toggle_items');
      result = await bulkToggle?.execute({
        listId: 'list-1',
        itemIds: firstHalfItems.map(item => item.identifier),
      });
      expect(result.content[0].text).toContain('Bulk toggle completed');
      
      // 5. Check current list state
      result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Checked items:');
      expect(result.content[0].text).toContain('Unchecked items:');
      
      // 6. Uncheck all items for next week's shopping
      const uncheckAll = mockServer.getTool('uncheck_all_items');
      result = await uncheckAll?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Successfully unchecked all items');
      
      // 7. Verify all items are unchecked
      result = await getListDetails?.execute({ listId: 'list-1' });
      expect(result.content[0].text).toContain('Checked items: 0');
      expect(result.content[0].text).toContain('Unchecked items:');
    });
  });

  describe('Error Recovery and Edge Cases Workflow', () => {
    it('should handle errors gracefully in complex workflows', async () => {
      // 1. Attempt to add items to non-existent list
      const bulkAdd = mockServer.getTool('bulk_add_items');
      let result = await bulkAdd?.execute({
        listId: 'nonexistent-list',
        items: [{ name: 'Test Item' }],
      });
      expect(result.content[0].text).toContain('0 successful, 1 failed');
      
      // 2. Mix of successful and failed operations
      vi.spyOn(anylistService, 'addItem')
        .mockResolvedValueOnce({
          listId: 'list-1',
          identifier: 'item-success',
          name: 'Success Item',
          details: undefined,
          quantity: undefined,
          checked: false,
          manualSortIndex: 0,
          userId: 'user-1',
          categoryMatchId: 'category-1',
        })
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          listId: 'list-1',
          identifier: 'item-success-2',
          name: 'Another Success',
          details: undefined,
          quantity: undefined,
          checked: false,
          manualSortIndex: 1,
          userId: 'user-1',
          categoryMatchId: 'category-1',
        });
      
      result = await bulkAdd?.execute({
        listId: 'list-1',
        items: [
          { name: 'Success Item' },
          { name: 'Failure Item' },
          { name: 'Another Success' },
        ],
      });
      expect(result.content[0].text).toContain('2 successful, 1 failed');
      expect(result.content[0].text).toContain('✓ Added "Success Item"');
      expect(result.content[0].text).toContain('✗ Failed to add "Failure Item"');
      expect(result.content[0].text).toContain('✓ Added "Another Success"');
      
      // 3. Attempt operations on non-existent recipes
      const createMeal = mockServer.getTool('create_meal_event');
      result = await createMeal?.execute({
        title: 'Test Meal',
        date: '2024-01-30',
        recipeId: 'nonexistent-recipe',
      });
      expect(result.content[0].text).toContain('Successfully created meal event'); // Still creates, just without valid recipe
      
      // 4. Search for non-existent recipe ingredients
      const searchRecipes = mockServer.getTool('search_recipes_by_ingredients');
      result = await searchRecipes?.execute({
        ingredients: ['dragon fruit'],
        matchAll: false,
      });
      expect(result.content[0].text).toContain('Found 0 recipes');
      
      // 5. Verify system is still functional after errors
      const getLists = mockServer.getTool('get_lists');
      result = await getLists?.execute({});
      expect(result.content[0].text).toContain('Found 2 lists');
    });
  });

  describe('Performance and Scalability Simulation', () => {
    it('should handle large bulk operations efficiently', async () => {
      // Simulate adding 50 items
      const largeItemList = Array.from({ length: 50 }, (_, i) => ({
        name: `Item ${i + 1}`,
        quantity: `${i + 1} units`,
        details: `Bulk item number ${i + 1}`,
      }));
      
      const bulkAdd = mockServer.getTool('bulk_add_items');
      const result = await bulkAdd?.execute({
        listId: 'list-1',
        items: largeItemList,
      });
      
      expect(result.content[0].text).toContain('50 successful, 0 failed');
      
      // Verify list has all items
      const getListDetails = mockServer.getTool('get_list_details');
      const listResult = await getListDetails?.execute({ listId: 'list-1' });
      expect(listResult.content[0].text).toContain('Total items: 52'); // 2 original + 50 new
      
      // Test bulk update on all items
      const currentItems = mockLists[0].items;
      const bulkUpdate = mockServer.getTool('bulk_update_items');
      const updateResult = await bulkUpdate?.execute({
        listId: 'list-1',
        updates: currentItems.map(item => ({
          itemId: item.identifier,
          details: `${item.details || ''} - Updated in bulk`,
        })),
      });
      
      expect(updateResult.content[0].text).toContain('52 successful, 0 failed');
      
      // Test bulk toggle on all items
      const bulkToggle = mockServer.getTool('bulk_toggle_items');
      const toggleResult = await bulkToggle?.execute({
        listId: 'list-1',
        itemIds: currentItems.map(item => item.identifier),
      });
      
      expect(toggleResult.content[0].text).toContain('52 successful, 0 failed');
    });
  });
});