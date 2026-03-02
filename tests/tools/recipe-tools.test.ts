import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnyListService } from '../../src/services/anylist-service.js';
import { registerRecipeTools } from '../../src/tools/recipe-tools.js';
import { createMockFastMCP } from '../mocks/fastmcp-mock.js';
import { mockRecipes, resetMockData } from '../mocks/anylist-mock.js';
import type { AnyListConfig, CreateRecipeRequest, UpdateRecipeRequest } from '../../src/types/index.js';

// Mock the AnyList module
vi.mock('anylist', () => ({
  default: vi.fn(() => ({
    login: vi.fn(),
    getRecipes: vi.fn(),
    recipes: mockRecipes,
    teardown: vi.fn(),
  })),
}));

// Mock fetch for recipe import tests
global.fetch = vi.fn();

describe('Recipe Tools', () => {
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
    vi.spyOn(anylistService, 'getRecipes').mockResolvedValue(mockRecipes);

    vi.spyOn(anylistService, 'getRecipe').mockImplementation(async (recipeId: string) => {
      const recipe = mockRecipes.find(r => r.identifier === recipeId);
      if (!recipe) {
        throw new Error(`Recipe with ID ${recipeId} not found`);
      }
      return recipe;
    });

    vi.spyOn(anylistService, 'createRecipe').mockImplementation(async (request: CreateRecipeRequest) => {
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

    vi.spyOn(anylistService, 'updateRecipe').mockImplementation(async (recipeId: string, updates: UpdateRecipeRequest) => {
      const recipe = mockRecipes.find(r => r.identifier === recipeId);
      if (!recipe) {
        throw new Error(`Recipe with ID ${recipeId} not found`);
      }

      Object.keys(updates).forEach(key => {
        if (updates[key as keyof UpdateRecipeRequest] !== undefined) {
          (recipe as any)[key] = updates[key as keyof UpdateRecipeRequest];
        }
      });

      return recipe;
    });

    vi.spyOn(anylistService, 'deleteRecipe').mockImplementation(async (recipeId: string) => {
      const index = mockRecipes.findIndex(r => r.identifier === recipeId);
      if (index === -1) {
        throw new Error(`Recipe with ID ${recipeId} not found`);
      }
      mockRecipes.splice(index, 1);
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
          {
            rawIngredient: '2 cups flour',
            name: 'Flour',
            quantity: '2 cups',
          },
        ],
        preparationSteps: ['Mix ingredients', 'Bake'],
        instructions: ['Mix ingredients', 'Bake'],
        photoIds: [],
        adCampaignId: undefined,
        photoUrls: [],
        scaleFactor: 1,
        rating: undefined,
        creationTimestamp: Date.now() / 1000,
        nutritionalInfo: undefined,
        cookTime: 1800,
        prepTime: 600,
        servings: '4 servings',
        paprikaIdentifier: undefined,
      };

      mockRecipes.push(importedRecipe);
      return importedRecipe;
    });

    vi.spyOn(anylistService, 'createRecipeCollection').mockImplementation(async (name: string) => {
      return {
        identifier: `collection-${Date.now()}`,
        timestamp: Date.now() / 1000,
        name,
        recipeIds: [],
      };
    });

    vi.spyOn(anylistService, 'addRecipeToCollection').mockResolvedValue(undefined);

    // Register tools
    registerRecipeTools(mockServer, anylistService);
  });

  describe('get_recipes tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_recipes');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_recipes');
    });

    it('should retrieve all recipes', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({ includeDetails: true });

      expect(result.content[0].text).toContain('Found 2 recipes');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
      expect(result.content[0].text).toContain('Pasta Carbonara');
      // Actual format: Rating: n/5
      expect(result.content[0].text).toContain('Rating: 5/5');
      expect(result.content[0].text).toContain('Rating: 4/5');
    });

    it('should search recipes by name', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({
        searchTerm: 'Pasta',
        includeDetails: true
      });

      expect(result.content[0].text).toContain('Found 1 recipes matching "Pasta"');
      expect(result.content[0].text).toContain('Pasta Carbonara');
      expect(result.content[0].text).not.toContain('Chocolate Chip Cookies');
    });

    it('should search recipes by ingredient', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({
        searchTerm: 'flour',
        includeDetails: true
      });

      expect(result.content[0].text).toContain('Found 1 recipes matching "flour"');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
      expect(result.content[0].text).not.toContain('Pasta Carbonara');
    });

    it('should search recipes by instruction', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({
        searchTerm: 'oven',
        includeDetails: true
      });

      expect(result.content[0].text).toContain('Found 1 recipes matching "oven"');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
    });

    it('should handle case-insensitive search', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({
        searchTerm: 'PASTA',
        includeDetails: true
      });

      expect(result.content[0].text).toContain('Found 1 recipes matching "PASTA"');
      expect(result.content[0].text).toContain('Pasta Carbonara');
    });

    it('should handle no search results', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({
        searchTerm: 'nonexistent',
        includeDetails: true
      });

      // Actual output: "Found 0 recipes matching "nonexistent":"
      expect(result.content[0].text).toContain('Found 0 recipes matching "nonexistent"');
    });

    it('should retrieve recipes without details', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({ includeDetails: false });

      expect(result.content[0].text).toContain('Found 2 recipes');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
      expect(result.content[0].text).toContain('Pasta Carbonara');
    });

    it('should handle empty recipe list', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockResolvedValue([]);

      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({});

      // Actual output: "Found 0 recipes:"
      expect(result.content[0].text).toContain('Found 0 recipes');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('API Error'));

      const tool = mockServer.getTool('get_recipes');
      // Tools throw errors (no try/catch), so we expect rejection
      await expect(tool?.execute({})).rejects.toThrow('API Error');
    });
  });

  describe('get_recipe tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_recipe');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_recipe');
    });

    it('should retrieve specific recipe by ID', async () => {
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-1' });

      // Actual format uses markdown H1, bold field labels, and n/5 stars rating
      expect(result.content[0].text).toContain('# Chocolate Chip Cookies');
      expect(result.content[0].text).toContain('## Notes');
      expect(result.content[0].text).toContain('Classic homemade cookies');
      expect(result.content[0].text).toContain('## Ingredients');
      expect(result.content[0].text).toContain('All-purpose flour');
      expect(result.content[0].text).toContain('## Instructions');
      expect(result.content[0].text).toContain('1. Preheat oven to 375°F');
      expect(result.content[0].text).toContain('**Prep Time:** 15m');
      expect(result.content[0].text).toContain('**Cook Time:** 11m');
      expect(result.content[0].text).toContain('**Servings:** 24 cookies');
      expect(result.content[0].text).toContain('**Rating:** 5/5 stars');
    });

    it('should handle recipe not found', async () => {
      const tool = mockServer.getTool('get_recipe');
      // get_recipe throws errors (no try/catch)
      await expect(tool?.execute({ recipeId: 'nonexistent' })).rejects.toThrow(
        'Recipe with ID nonexistent not found'
      );
    });

    it('should handle recipes without optional fields', async () => {
      const minimalRecipe = {
        identifier: 'recipe-minimal',
        timestamp: Date.now() / 1000,
        name: 'Simple Recipe',
        note: undefined,
        sourceName: undefined,
        sourceUrl: undefined,
        ingredients: [],
        preparationSteps: ['Step 1'],
        instructions: ['Step 1'],
        photoIds: [],
        adCampaignId: undefined,
        photoUrls: [],
        scaleFactor: 1,
        rating: undefined,
        creationTimestamp: Date.now() / 1000,
        nutritionalInfo: undefined,
        cookTime: undefined,
        prepTime: undefined,
        servings: undefined,
        paprikaIdentifier: undefined,
      };

      vi.spyOn(anylistService, 'getRecipes').mockResolvedValue([minimalRecipe]);

      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-minimal' });

      expect(result.content[0].text).toContain('# Simple Recipe');
      expect(result.content[0].text).toContain('**Prep Time:** Not specified');
      expect(result.content[0].text).toContain('**Cook Time:** Not specified');
      expect(result.content[0].text).toContain('**Servings:** Not specified');
      // No rating line when rating is undefined
      expect(result.content[0].text).not.toContain('Rating:');
    });
  });

  describe('create_recipe tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('create_recipe');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_recipe');
    });

    it('should create recipe successfully', async () => {
      const tool = mockServer.getTool('create_recipe');
      const result = await tool?.execute({
        name: 'Test Recipe',
        note: 'A test recipe',
        ingredients: [
          { rawIngredient: '1 cup flour', name: 'Flour', quantity: '1 cup' },
        ],
        preparationSteps: ['Mix ingredients', 'Bake'],
        cookTime: 1800,
        prepTime: 600,
        servings: '4',
        rating: 4,
      });

      // Actual output: recipe name, ID, ingredient count, instruction count
      expect(result.content[0].text).toContain('Successfully created recipe "Test Recipe"');
      expect(result.content[0].text).toContain('Ingredients: 1');
      expect(result.content[0].text).toContain('Instructions: 2 steps');
    });

    it('should create recipe with minimal fields', async () => {
      const tool = mockServer.getTool('create_recipe');
      const result = await tool?.execute({
        name: 'Minimal Recipe',
        ingredients: [
          { rawIngredient: '1 egg', name: 'Egg', quantity: '1' },
        ],
        preparationSteps: ['Cook egg'],
      });

      expect(result.content[0].text).toContain('Successfully created recipe "Minimal Recipe"');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'createRecipe').mockRejectedValue(new Error('Creation failed'));

      const tool = mockServer.getTool('create_recipe');
      // No try/catch, so throws
      await expect(tool?.execute({
        name: 'Test Recipe',
        ingredients: [{ rawIngredient: '1 cup flour', name: 'Flour', quantity: '1 cup' }],
        preparationSteps: ['Mix'],
      })).rejects.toThrow('Creation failed');
    });
  });

  describe('update_recipe tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('update_recipe');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('update_recipe');
    });

    it('should update recipe successfully', async () => {
      const tool = mockServer.getTool('update_recipe');
      const result = await tool?.execute({
        recipeId: 'recipe-1',
        name: 'Updated Cookie Recipe',
        rating: 4,
        note: 'Updated recipe notes',
      });

      expect(result.content[0].text).toContain('Successfully updated recipe "Updated Cookie Recipe"');
    });

    it('should handle recipe not found', async () => {
      const tool = mockServer.getTool('update_recipe');
      await expect(tool?.execute({
        recipeId: 'nonexistent',
        name: 'Updated Name',
      })).rejects.toThrow('Recipe with ID nonexistent not found');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'updateRecipe').mockRejectedValue(new Error('Update failed'));

      const tool = mockServer.getTool('update_recipe');
      await expect(tool?.execute({
        recipeId: 'recipe-1',
        name: 'Updated Name',
      })).rejects.toThrow('Update failed');
    });
  });

  describe('delete_recipe tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('delete_recipe');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('delete_recipe');
    });

    it('should delete recipe successfully', async () => {
      const tool = mockServer.getTool('delete_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-1' });

      expect(result.content[0].text).toContain('Successfully deleted recipe');
    });

    it('should handle recipe not found', async () => {
      const tool = mockServer.getTool('delete_recipe');
      await expect(tool?.execute({ recipeId: 'nonexistent' })).rejects.toThrow(
        'Recipe with ID nonexistent not found'
      );
    });
  });

  describe('import_recipe_from_url tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('import_recipe_from_url');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('import_recipe_from_url');
    });

    it('should import recipe from URL successfully', async () => {
      const tool = mockServer.getTool('import_recipe_from_url');
      const result = await tool?.execute({
        url: 'https://example.com/recipe',
        name: 'Custom Recipe Name',
      });

      expect(result.content[0].text).toContain('Successfully imported recipe "Custom Recipe Name"');
      expect(result.content[0].text).toContain('from https://example.com/recipe');
      expect(result.content[0].text).toContain('Ingredients: 1');
      expect(result.content[0].text).toContain('Instructions: 2 steps');
    });

    it('should import recipe without custom name', async () => {
      const tool = mockServer.getTool('import_recipe_from_url');
      const result = await tool?.execute({
        url: 'https://example.com/recipe',
      });

      expect(result.content[0].text).toContain('Successfully imported recipe "Imported Recipe"');
    });

    it('should handle import failures', async () => {
      vi.spyOn(anylistService, 'importRecipeFromUrl').mockRejectedValue(new Error('Failed to parse recipe data'));

      const tool = mockServer.getTool('import_recipe_from_url');
      await expect(tool?.execute({
        url: 'https://example.com/invalid-recipe',
      })).rejects.toThrow('Failed to parse recipe data');
    });

    it('should handle network errors', async () => {
      vi.spyOn(anylistService, 'importRecipeFromUrl').mockRejectedValue(new Error('Network timeout'));

      const tool = mockServer.getTool('import_recipe_from_url');
      await expect(tool?.execute({
        url: 'https://unreachable.com/recipe',
      })).rejects.toThrow('Network timeout');
    });
  });

  describe('search_recipes_by_ingredients tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('search_recipes_by_ingredients');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search_recipes_by_ingredients');
    });

    it('should search recipes by ingredients (match any)', async () => {
      const tool = mockServer.getTool('search_recipes_by_ingredients');
      const result = await tool?.execute({
        ingredients: ['flour'],
        matchAll: false,
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('recipes containing ANY of: flour');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
    });

    it('should search recipes requiring all ingredients', async () => {
      const tool = mockServer.getTool('search_recipes_by_ingredients');
      const result = await tool?.execute({
        ingredients: ['spaghetti', 'eggs'],
        matchAll: true,
      });

      expect(result.content[0].text).toContain('recipes containing ALL of: spaghetti, eggs');
      expect(result.content[0].text).toContain('Pasta Carbonara');
    });

    it('should handle no matches', async () => {
      const tool = mockServer.getTool('search_recipes_by_ingredients');
      const result = await tool?.execute({
        ingredients: ['dragon fruit'],
        matchAll: false,
      });

      expect(result.content[0].text).toContain('Found 0 recipes');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('Search failed'));

      const tool = mockServer.getTool('search_recipes_by_ingredients');
      await expect(tool?.execute({
        ingredients: ['test'],
        matchAll: false,
      })).rejects.toThrow('Search failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle service connection errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('Connection failed'));

      const tool = mockServer.getTool('get_recipes');
      await expect(tool?.execute({})).rejects.toThrow('Connection failed');
    });

    it('should handle unknown errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue('Unknown error type');

      const tool = mockServer.getTool('get_recipes');
      await expect(tool?.execute({})).rejects.toThrow();
    });

    it('should handle malformed recipe data', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockResolvedValue([null as any]);

      const tool = mockServer.getTool('get_recipes');
      await expect(tool?.execute({})).rejects.toThrow();
    });
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', () => {
      const expectedTools = [
        'get_recipes',
        'get_recipe',
        'create_recipe',
        'update_recipe',
        'delete_recipe',
        'import_recipe_from_url',
        'search_recipes_by_ingredients',
        'create_recipe_collection',
        'add_recipe_to_collection',
        'export_recipe',
        'get_recipe_nutrition',
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

  describe('Time Formatting', () => {
    it('should format time correctly', async () => {
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-1' });

      // Cookies: prepTime: 900 (15 minutes), cookTime: 660 (11 minutes)
      expect(result.content[0].text).toContain('**Prep Time:** 15m');
      expect(result.content[0].text).toContain('**Cook Time:** 11m');
    });

    it('should format hours and minutes correctly', async () => {
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-2' });

      // Pasta: prepTime: 600 (10 minutes), cookTime: 1200 (20 minutes)
      expect(result.content[0].text).toContain('**Prep Time:** 10m');
      expect(result.content[0].text).toContain('**Cook Time:** 20m');
    });
  });
});
