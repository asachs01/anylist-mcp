import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnyListService } from '../../src/services/anylist-service.js';
import { UserError } from 'fastmcp';
import { mockLists, mockRecipes, mockMealEvents, resetMockData, MockAnyListClient } from '../mocks/anylist-mock.js';
import type { AnyListConfig } from '../../src/types/index.js';

// Mock the entire anylist module
const { mockConstructor } = vi.hoisted(() => {
  return { mockConstructor: vi.fn() };
});
vi.mock('anylist', () => ({
  __esModule: true,
  default: mockConstructor,
}));

// Mock fetch for recipe import tests
global.fetch = vi.fn();

describe('AnyListService', () => {
  let service: AnyListService;
  let mockClient: MockAnyListClient;
  const mockConfig: AnyListConfig = {
    email: 'test@example.com',
    password: 'test-password',
    credentialsFile: '.test_credentials',
  };

  beforeEach(() => {
    resetMockData();
    mockClient = new MockAnyListClient();
    mockConstructor.mockImplementation(() => mockClient);

    service = new AnyListService(mockConfig);
  });

  afterEach(async () => {
    try {
      await service.disconnect();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should connect successfully', async () => {
      await expect(service.connect()).resolves.not.toThrow();
    });

    it('should handle connection errors', async () => {
      vi.spyOn(mockClient, 'login').mockRejectedValue(new Error('Authentication failed'));
      
      await expect(service.connect()).rejects.toThrow(UserError);
      await expect(service.connect()).rejects.toThrow('Failed to connect to AnyList: Authentication failed');
    });

    it('should handle unknown connection errors', async () => {
      vi.spyOn(mockClient, 'login').mockRejectedValue('Unknown error');
      
      await expect(service.connect()).rejects.toThrow(UserError);
      await expect(service.connect()).rejects.toThrow('Failed to connect to AnyList: Unknown error');
    });

    it('should only connect once for multiple calls', async () => {
      const loginSpy = vi.spyOn(mockClient, 'login');
      
      await service.connect();
      await service.connect();
      await service.connect();
      
      expect(loginSpy).toHaveBeenCalledTimes(1);
    });

    it('should disconnect properly', async () => {
      await service.connect();
      const teardownSpy = vi.spyOn(mockClient, 'teardown');
      
      await service.disconnect();
      
      expect(teardownSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle disconnect errors gracefully', async () => {
      await service.connect();
      vi.spyOn(mockClient, 'teardown').mockImplementation(() => {
        throw new Error('Teardown failed');
      });
      
      await expect(service.disconnect()).resolves.not.toThrow();
    });

    it('should reset connection state after failed connection', async () => {
      vi.spyOn(mockClient, 'login').mockRejectedValueOnce(new Error('First failure'));
      
      await expect(service.connect()).rejects.toThrow();
      
      // Mock successful connection on retry
      vi.spyOn(mockClient, 'login').mockResolvedValueOnce(undefined);
      
      await expect(service.connect()).resolves.not.toThrow();
    });
  });

  describe('List Management', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should get all lists', async () => {
      const lists = await service.getLists();
      
      expect(lists).toHaveLength(2);
      expect(lists[0].name).toBe('Grocery List');
      expect(lists[0].items).toHaveLength(2);
      expect(lists[1].name).toBe('Shopping List');
      expect(lists[1].items).toHaveLength(1);
    });

    it('should handle getLists errors', async () => {
      vi.spyOn(mockClient, 'getLists').mockRejectedValue(new Error('Network error'));
      
      await expect(service.getLists()).rejects.toThrow(UserError);
      await expect(service.getLists()).rejects.toThrow('Failed to get lists: Network error');
    });

    it('should throw error for createList (not supported)', async () => {
      await expect(service.createList({ name: 'New List' })).rejects.toThrow(UserError);
      await expect(service.createList({ name: 'New List' })).rejects.toThrow('Creating lists is not currently supported');
    });

    it('should add item to list', async () => {
      const item = await service.addItem({
        listId: 'list-1',
        name: 'Apples',
        details: 'Red delicious',
        quantity: '6 count',
      });
      
      expect(item.name).toBe('Apples');
      expect(item.details).toBe('Red delicious');
      expect(item.quantity).toBe('6 count');
      expect(item.listId).toBe('list-1');
      expect(item.checked).toBe(false);
    });

    it('should handle addItem with invalid list ID', async () => {
      vi.spyOn(mockClient, 'getListById').mockReturnValue(null);
      
      await expect(service.addItem({
        listId: 'invalid-list',
        name: 'Test Item',
      })).rejects.toThrow(UserError);
      await expect(service.addItem({
        listId: 'invalid-list',
        name: 'Test Item',
      })).rejects.toThrow('List with ID invalid-list not found');
    });

    it('should handle addItem errors', async () => {
      const mockList = mockClient.getListById('list-1');
      vi.spyOn(mockList!, 'addItem').mockRejectedValue(new Error('Add failed'));
      
      await expect(service.addItem({
        listId: 'list-1',
        name: 'Test Item',
      })).rejects.toThrow(UserError);
      await expect(service.addItem({
        listId: 'list-1',
        name: 'Test Item',
      })).rejects.toThrow('Failed to add item: Add failed');
    });

    it('should update item', async () => {
      const item = await service.updateItem({
        listId: 'list-1',
        itemId: 'item-1',
        name: 'Organic Milk',
        checked: true,
        quantity: '2 gallons',
      });
      
      expect(item.name).toBe('Organic Milk');
      expect(item.checked).toBe(true);
      expect(item.quantity).toBe('2 gallons');
    });

    it('should handle updateItem with invalid list ID', async () => {
      vi.spyOn(mockClient, 'getListById').mockReturnValue(null);
      
      await expect(service.updateItem({
        listId: 'invalid-list',
        itemId: 'item-1',
        name: 'Updated Item',
      })).rejects.toThrow(UserError);
      await expect(service.updateItem({
        listId: 'invalid-list',
        itemId: 'item-1',
        name: 'Updated Item',
      })).rejects.toThrow('List with ID invalid-list not found');
    });

    it('should handle updateItem with invalid item ID', async () => {
      const mockList = mockClient.getListById('list-1');
      vi.spyOn(mockList!, 'getItemById').mockReturnValue(null);
      
      await expect(service.updateItem({
        listId: 'list-1',
        itemId: 'invalid-item',
        name: 'Updated Item',
      })).rejects.toThrow(UserError);
      await expect(service.updateItem({
        listId: 'list-1',
        itemId: 'invalid-item',
        name: 'Updated Item',
      })).rejects.toThrow('Item with ID invalid-item not found');
    });

    it('should handle updateItem errors', async () => {
      const mockList = mockClient.getListById('list-1');
      const mockItem = mockList!.getItemById('item-1');
      vi.spyOn(mockItem!, 'save').mockRejectedValue(new Error('Save failed'));
      
      await expect(service.updateItem({
        listId: 'list-1',
        itemId: 'item-1',
        name: 'Updated Item',
      })).rejects.toThrow(UserError);
      await expect(service.updateItem({
        listId: 'list-1',
        itemId: 'item-1',
        name: 'Updated Item',
      })).rejects.toThrow('Failed to update item: Save failed');
    });

    it('should remove item (mark as checked)', async () => {
      await service.removeItem('list-1', 'item-1');
      
      // Verify item was marked as checked
      const lists = await service.getLists();
      const list = lists.find(l => l.identifier === 'list-1');
      const item = list?.items.find(i => i.identifier === 'item-1');
      
      expect(item?.checked).toBe(true);
    });

    it('should handle removeItem with invalid list ID', async () => {
      vi.spyOn(mockClient, 'getListById').mockReturnValue(null);
      
      await expect(service.removeItem('invalid-list', 'item-1')).rejects.toThrow(UserError);
      await expect(service.removeItem('invalid-list', 'item-1')).rejects.toThrow('List with ID invalid-list not found');
    });

    it('should handle removeItem with invalid item ID', async () => {
      const mockList = mockClient.getListById('list-1');
      vi.spyOn(mockList!, 'getItemById').mockReturnValue(null);
      
      await expect(service.removeItem('list-1', 'invalid-item')).rejects.toThrow(UserError);
      await expect(service.removeItem('list-1', 'invalid-item')).rejects.toThrow('Item with ID invalid-item not found');
    });

    it('should uncheck all items in list', async () => {
      await service.uncheckAllItems('list-1');
      
      const lists = await service.getLists();
      const list = lists.find(l => l.identifier === 'list-1');
      
      expect(list?.items.every(item => !item.checked)).toBe(true);
    });

    it('should handle uncheckAllItems with invalid list ID', async () => {
      vi.spyOn(mockClient, 'getListById').mockReturnValue(null);
      
      await expect(service.uncheckAllItems('invalid-list')).rejects.toThrow(UserError);
      await expect(service.uncheckAllItems('invalid-list')).rejects.toThrow('List with ID invalid-list not found');
    });
  });

  describe('Recipe Management', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should get all recipes', async () => {
      const recipes = await service.getRecipes();
      
      expect(recipes).toHaveLength(2);
      expect(recipes[0].name).toBe('Chocolate Chip Cookies');
      expect(recipes[1].name).toBe('Pasta Carbonara');
    });

    it('should handle getRecipes errors', async () => {
      vi.spyOn(mockClient, 'getRecipes').mockRejectedValue(new Error('Network error'));
      
      await expect(service.getRecipes()).rejects.toThrow(UserError);
      await expect(service.getRecipes()).rejects.toThrow('Failed to get recipes: Network error');
    });

    it('should get specific recipe', async () => {
      const recipe = await service.getRecipe('recipe-1');
      
      expect(recipe.name).toBe('Chocolate Chip Cookies');
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.instructions).toHaveLength(6);
    });

    it('should handle getRecipe with invalid ID', async () => {
      await expect(service.getRecipe('invalid-recipe')).rejects.toThrow(UserError);
      await expect(service.getRecipe('invalid-recipe')).rejects.toThrow('Recipe with ID invalid-recipe not found');
    });

    it('should create recipe', async () => {
      const recipe = await service.createRecipe({
        name: 'Test Recipe',
        note: 'A test recipe',
        ingredients: [
          { rawIngredient: '1 cup flour', name: 'Flour', quantity: '1 cup' },
        ],
        preparationSteps: ['Mix ingredients', 'Cook'],
        cookTime: 1800,
        prepTime: 600,
        servings: '4',
        rating: 4,
      });
      
      expect(recipe.name).toBe('Test Recipe');
      expect(recipe.note).toBe('A test recipe');
      expect(recipe.ingredients).toHaveLength(1);
      expect(recipe.preparationSteps).toHaveLength(2);
      expect(recipe.cookTime).toBe(1800);
      expect(recipe.prepTime).toBe(600);
      expect(recipe.servings).toBe('4');
      expect(recipe.rating).toBe(4);
    });

    it('should handle createRecipe errors', async () => {
      const mockRecipe = await mockClient.createRecipe({});
      vi.spyOn(mockRecipe, 'save').mockRejectedValue(new Error('Save failed'));
      vi.spyOn(mockClient, 'createRecipe').mockResolvedValue(mockRecipe);
      
      await expect(service.createRecipe({
        name: 'Test Recipe',
        ingredients: [],
        preparationSteps: [],
      })).rejects.toThrow(UserError);
      await expect(service.createRecipe({
        name: 'Test Recipe',
        ingredients: [],
        preparationSteps: [],
      })).rejects.toThrow('Failed to create recipe: Save failed');
    });

    it('should update recipe', async () => {
      const recipe = await service.updateRecipe('recipe-1', {
        name: 'Updated Cookie Recipe',
        rating: 4,
        note: 'Updated notes',
      });
      
      expect(recipe.name).toBe('Updated Cookie Recipe');
      expect(recipe.rating).toBe(4);
      expect(recipe.note).toBe('Updated notes');
    });

    it('should handle updateRecipe with invalid ID', async () => {
      await expect(service.updateRecipe('invalid-recipe', {
        name: 'Updated Name',
      })).rejects.toThrow(UserError);
      await expect(service.updateRecipe('invalid-recipe', {
        name: 'Updated Name',
      })).rejects.toThrow('Recipe with ID invalid-recipe not found');
    });

    it('should delete recipe', async () => {
      await expect(service.deleteRecipe('recipe-1')).resolves.not.toThrow();
    });

    it('should handle deleteRecipe with invalid ID', async () => {
      await expect(service.deleteRecipe('invalid-recipe')).rejects.toThrow(UserError);
      await expect(service.deleteRecipe('invalid-recipe')).rejects.toThrow('Recipe with ID invalid-recipe not found');
    });
  });

  describe('Recipe Import', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should import recipe from URL with JSON-LD', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Recipe</title>
            <script type="application/ld+json">
              {
                "@type": "Recipe",
                "name": "JSON-LD Recipe",
                "description": "A test recipe from JSON-LD",
                "recipeIngredient": ["1 cup flour", "2 eggs"],
                "recipeInstructions": [
                  {"text": "Mix ingredients"},
                  {"text": "Bake for 30 minutes"}
                ],
                "prepTime": "PT15M",
                "cookTime": "PT30M",
                "recipeYield": "4 servings"
              }
            </script>
          </head>
        </html>
      `;
      
      (global.fetch as any).mockResolvedValue({
        text: () => Promise.resolve(mockHtml),
      });
      
      const recipe = await service.importRecipeFromUrl({
        url: 'https://example.com/recipe',
      });
      
      expect(recipe.name).toBe('JSON-LD Recipe');
      expect(recipe.note).toBe('A test recipe from JSON-LD');
      expect(recipe.sourceName).toBe('example.com');
      expect(recipe.sourceUrl).toBe('https://example.com/recipe');
      expect(recipe.ingredients).toHaveLength(2);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.prepTime).toBe(900); // 15 minutes in seconds
      expect(recipe.cookTime).toBe(1800); // 30 minutes in seconds
      expect(recipe.servings).toBe('4 servings');
    });

    it('should import recipe from URL with fallback parsing', async () => {
      const mockHtml = `
        <html>
          <head><title>Fallback Recipe - Example.com</title></head>
          <body>
            <div class="ingredient">1 cup flour</div>
            <div class="ingredient">2 eggs</div>
            <div class="instruction">Mix ingredients</div>
            <div class="instruction">Bake</div>
          </body>
        </html>
      `;
      
      (global.fetch as any).mockResolvedValue({
        text: () => Promise.resolve(mockHtml),
      });
      
      const recipe = await service.importRecipeFromUrl({
        url: 'https://example.com/recipe',
        name: 'Custom Recipe Name',
      });
      
      expect(recipe.name).toBe('Custom Recipe Name');
      expect(recipe.sourceName).toBe('example.com');
      expect(recipe.ingredients).toHaveLength(2);
      expect(recipe.instructions).toHaveLength(2);
    });

    it('should handle import failure with insufficient data', async () => {
      const mockHtml = `
        <html>
          <head><title>Incomplete Recipe</title></head>
          <body>
            <p>This page has no recipe data</p>
          </body>
        </html>
      `;
      
      (global.fetch as any).mockResolvedValue({
        text: () => Promise.resolve(mockHtml),
      });
      
      await expect(service.importRecipeFromUrl({
        url: 'https://example.com/incomplete',
      })).rejects.toThrow(UserError);
      await expect(service.importRecipeFromUrl({
        url: 'https://example.com/incomplete',
      })).rejects.toThrow('Could not extract recipe data from URL');
    });

    it('should handle network errors during import', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network timeout'));
      
      await expect(service.importRecipeFromUrl({
        url: 'https://unreachable.com/recipe',
      })).rejects.toThrow(UserError);
      await expect(service.importRecipeFromUrl({
        url: 'https://unreachable.com/recipe',
      })).rejects.toThrow('Failed to import recipe from URL: Network timeout');
    });

    it('should handle malformed JSON-LD', async () => {
      const mockHtml = `
        <html>
          <script type="application/ld+json">
            { invalid json
          </script>
        </html>
      `;
      
      (global.fetch as any).mockResolvedValue({
        text: () => Promise.resolve(mockHtml),
      });
      
      // Should fall back to HTML parsing, but since there's no valid data, should fail
      await expect(service.importRecipeFromUrl({
        url: 'https://example.com/malformed',
      })).rejects.toThrow(UserError);
    });

    it('should parse time durations correctly', async () => {
      const mockHtml = `
        <script type="application/ld+json">
          {
            "@type": "Recipe",
            "name": "Time Test Recipe",
            "recipeIngredient": ["1 cup flour"],
            "recipeInstructions": [{"text": "Cook"}],
            "prepTime": "PT1H30M",
            "cookTime": "PT45M"
          }
        </script>
      `;
      
      (global.fetch as any).mockResolvedValue({
        text: () => Promise.resolve(mockHtml),
      });
      
      const recipe = await service.importRecipeFromUrl({
        url: 'https://example.com/time-test',
      });
      
      expect(recipe.prepTime).toBe(5400); // 1 hour 30 minutes = 5400 seconds
      expect(recipe.cookTime).toBe(2700); // 45 minutes = 2700 seconds
    });
  });

  describe('Meal Planning', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should get all meal events', async () => {
      const events = await service.getMealEvents();
      
      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Pasta Night');
      expect(events[1].title).toBe('Sandwich Day');
    });

    it('should filter meal events by date range', async () => {
      const events = await service.getMealEvents('2024-01-15', '2024-01-15');
      
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Pasta Night');
    });

    it('should filter meal events by start date only', async () => {
      const events = await service.getMealEvents('2024-01-16');
      
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Sandwich Day');
    });

    it('should filter meal events by end date only', async () => {
      const events = await service.getMealEvents(undefined, '2024-01-15');
      
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Pasta Night');
    });

    it('should handle getMealEvents errors', async () => {
      vi.spyOn(mockClient, 'getMealPlanningCalendarEvents').mockRejectedValue(new Error('Network error'));
      
      await expect(service.getMealEvents()).rejects.toThrow(UserError);
      await expect(service.getMealEvents()).rejects.toThrow('Failed to get meal events: Network error');
    });

    it('should get specific meal event', async () => {
      const event = await service.getMealEvent('meal-1');
      
      expect(event?.title).toBe('Pasta Night');
      expect(event?.recipeId).toBe('recipe-2');
    });

    it('should return null for non-existent meal event', async () => {
      const event = await service.getMealEvent('invalid-event');
      
      expect(event).toBeNull();
    });

    it('should handle getMealEvent errors', async () => {
      vi.spyOn(mockClient, 'getMealPlanningCalendarEvents').mockRejectedValue(new Error('Network error'));
      
      await expect(service.getMealEvent('meal-1')).rejects.toThrow(UserError);
      await expect(service.getMealEvent('meal-1')).rejects.toThrow('Failed to get meal event: Network error');
    });

    it('should create meal event', async () => {
      const event = await service.createMealEvent({
        title: 'Taco Tuesday',
        date: '2024-01-20',
        details: 'Family dinner',
        recipeId: 'recipe-1',
        recipeScaleFactor: 2,
      });
      
      expect(event.title).toBe('Taco Tuesday');
      expect(event.date).toEqual(new Date('2024-01-20'));
      expect(event.details).toBe('Family dinner');
      expect(event.recipeId).toBe('recipe-1');
      expect(event.recipeScaleFactor).toBe(2);
    });

    it('should handle createMealEvent errors', async () => {
      const mockEvent = await mockClient.createEvent({});
      vi.spyOn(mockEvent, 'save').mockRejectedValue(new Error('Save failed'));
      vi.spyOn(mockClient, 'createEvent').mockResolvedValue(mockEvent);

      await expect(service.createMealEvent({
        title: 'Test Event',
        date: '2024-01-20',
      })).rejects.toThrow(UserError);
      await expect(service.createMealEvent({
        title: 'Test Event',
        date: '2024-01-20',
      })).rejects.toThrow('Failed to create meal event: Save failed');
    });

    it('should delete meal event', async () => {
      await expect(service.deleteMealEvent('meal-1')).resolves.not.toThrow();
    });

    it('should handle deleteMealEvent with invalid ID', async () => {
      await expect(service.deleteMealEvent('invalid-event')).rejects.toThrow(UserError);
      await expect(service.deleteMealEvent('invalid-event')).rejects.toThrow('Meal event with ID invalid-event not found');
    });
  });

  describe('Recipe Collections', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should create recipe collection', async () => {
      const collection = await service.createRecipeCollection('Test Collection');
      expect(collection.name).toBe('Test Collection');
      expect(collection.identifier).toBeDefined();
      expect(collection.recipeIds).toEqual([]);
    });

    it('should add recipe to collection', async () => {
      await expect(service.addRecipeToCollection('collection-1', 'recipe-1')).resolves.not.toThrow();
    });

    it('should handle addRecipeToCollection with invalid collection ID', async () => {
      await expect(service.addRecipeToCollection('invalid-collection', 'recipe-1')).rejects.toThrow(UserError);
      await expect(service.addRecipeToCollection('invalid-collection', 'recipe-1')).rejects.toThrow('Recipe collection with ID invalid-collection not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection required errors', async () => {
      // Make login fail so ensureConnected fails
      vi.spyOn(mockClient, 'login').mockRejectedValue(new Error('Authentication failed'));
      await expect(service.getLists()).rejects.toThrow(UserError);
      await expect(service.getLists()).rejects.toThrow('Failed to connect to AnyList');
    });

    it('should handle unknown error types', async () => {
      await service.connect();
      vi.spyOn(mockClient, 'getLists').mockRejectedValue('Unknown error type');
      
      await expect(service.getLists()).rejects.toThrow(UserError);
      await expect(service.getLists()).rejects.toThrow('Failed to get lists: Unknown error type');
    });

    it('should map error messages correctly', async () => {
      await service.connect();
      
      // Test with Error object
      vi.spyOn(mockClient, 'getLists').mockRejectedValue(new Error('Network error'));
      await expect(service.getLists()).rejects.toThrow('Network error');
      
      // Test with string
      vi.spyOn(mockClient, 'getLists').mockRejectedValue('String error');
      await expect(service.getLists()).rejects.toThrow('String error');
      
      // Test with number
      vi.spyOn(mockClient, 'getLists').mockRejectedValue(404);
      await expect(service.getLists()).rejects.toThrow('404');
    });
  });

  describe('Data Mapping', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should map item data correctly', async () => {
      const lists = await service.getLists();
      const item = lists[0].items[0];
      
      expect(item).toHaveProperty('listId');
      expect(item).toHaveProperty('identifier');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('details');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('checked');
      expect(item).toHaveProperty('manualSortIndex');
      expect(item).toHaveProperty('userId');
      expect(item).toHaveProperty('categoryMatchId');
    });

    it('should map recipe data correctly', async () => {
      const recipes = await service.getRecipes();
      const recipe = recipes[0];
      
      expect(recipe).toHaveProperty('identifier');
      expect(recipe).toHaveProperty('timestamp');
      expect(recipe).toHaveProperty('name');
      expect(recipe).toHaveProperty('note');
      expect(recipe).toHaveProperty('sourceName');
      expect(recipe).toHaveProperty('sourceUrl');
      expect(recipe).toHaveProperty('ingredients');
      expect(recipe).toHaveProperty('preparationSteps');
      expect(recipe).toHaveProperty('instructions');
      expect(recipe).toHaveProperty('photoIds');
      expect(recipe).toHaveProperty('photoUrls');
      expect(recipe).toHaveProperty('scaleFactor');
      expect(recipe).toHaveProperty('rating');
      expect(recipe).toHaveProperty('creationTimestamp');
      expect(recipe).toHaveProperty('nutritionalInfo');
      expect(recipe).toHaveProperty('cookTime');
      expect(recipe).toHaveProperty('prepTime');
      expect(recipe).toHaveProperty('servings');
      
      // Check that instructions is mapped from preparationSteps
      expect(recipe.instructions).toEqual(recipe.preparationSteps);
    });

    it('should map meal event data correctly', async () => {
      const events = await service.getMealEvents();
      const event = events[0];
      
      expect(event).toHaveProperty('identifier');
      expect(event).toHaveProperty('calendarId');
      expect(event).toHaveProperty('date');
      expect(event).toHaveProperty('details');
      expect(event).toHaveProperty('labelId');
      expect(event).toHaveProperty('label');
      expect(event).toHaveProperty('logicalTimestamp');
      expect(event).toHaveProperty('orderAddedSortIndex');
      expect(event).toHaveProperty('recipeId');
      expect(event).toHaveProperty('recipe');
      expect(event).toHaveProperty('recipeScaleFactor');
      expect(event).toHaveProperty('title');
    });
  });
});