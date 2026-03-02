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
      
      // Update recipe properties
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
      
      // Note: AnyList API doesn't support deletion, so we simulate it here for testing
      mockRecipes.splice(index, 1);
    });
    
    vi.spyOn(anylistService, 'importRecipeFromUrl').mockImplementation(async (request) => {
      // Mock a successful import
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
        cookTime: 1800, // 30 minutes
        prepTime: 600, // 10 minutes
        servings: '4 servings',
        paprikaIdentifier: undefined,
      };
      
      mockRecipes.push(importedRecipe);
      return importedRecipe;
    });
    
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
      expect(result.content[0].text).toContain('Rating: ⭐⭐⭐⭐⭐');
      expect(result.content[0].text).toContain('Rating: ⭐⭐⭐⭐');
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
      
      expect(result.content[0].text).toContain('No recipes found matching "nonexistent"');
    });

    it('should retrieve recipes without details', async () => {
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({ includeDetails: false });
      
      expect(result.content[0].text).toContain('Found 2 recipes');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
      expect(result.content[0].text).toContain('Pasta Carbonara');
      // Should not contain detailed ingredients/instructions
      expect(result.content[0].text).not.toContain('Ingredients:');
      expect(result.content[0].text).not.toContain('Instructions:');
    });

    it('should handle empty recipe list', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockResolvedValue([]);
      
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('No recipes found');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('API Error'));
      
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving recipes: API Error');
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
      
      expect(result.content[0].text).toContain('**Chocolate Chip Cookies**');
      expect(result.content[0].text).toContain('Classic homemade cookies');
      expect(result.content[0].text).toContain('**Ingredients:**');
      expect(result.content[0].text).toContain('- All-purpose flour (2 cups)');
      expect(result.content[0].text).toContain('**Instructions:**');
      expect(result.content[0].text).toContain('1. Preheat oven to 375°F');
      expect(result.content[0].text).toContain('Prep Time: 15m');
      expect(result.content[0].text).toContain('Cook Time: 11m');
      expect(result.content[0].text).toContain('Servings: 24 cookies');
      expect(result.content[0].text).toContain('Rating: ⭐⭐⭐⭐⭐');
    });

    it('should handle recipe not found', async () => {
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'nonexistent' });
      
      expect(result.content[0].text).toContain('Error retrieving recipe: Recipe with ID nonexistent not found');
    });

    it('should handle recipes without optional fields', async () => {
      // Add recipe with minimal fields
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
      
      vi.spyOn(anylistService, 'getRecipe').mockResolvedValue(minimalRecipe);
      
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-minimal' });
      
      expect(result.content[0].text).toContain('**Simple Recipe**');
      expect(result.content[0].text).toContain('Prep Time: Not specified');
      expect(result.content[0].text).toContain('Cook Time: Not specified');
      expect(result.content[0].text).toContain('Servings: Not specified');
      expect(result.content[0].text).toContain('Rating: Not rated');
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
      
      expect(result.content[0].text).toContain('Successfully created recipe "Test Recipe"');
      expect(result.content[0].text).toContain('Prep time: 10m');
      expect(result.content[0].text).toContain('Cook time: 30m');
      expect(result.content[0].text).toContain('Rating: 4/5');
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
      const result = await tool?.execute({
        name: 'Test Recipe',
        ingredients: [{ rawIngredient: '1 cup flour', name: 'Flour', quantity: '1 cup' }],
        preparationSteps: ['Mix'],
      });
      
      expect(result.content[0].text).toContain('Error creating recipe: Creation failed');
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
      const result = await tool?.execute({
        recipeId: 'nonexistent',
        name: 'Updated Name',
      });
      
      expect(result.content[0].text).toContain('Error updating recipe: Recipe with ID nonexistent not found');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'updateRecipe').mockRejectedValue(new Error('Update failed'));
      
      const tool = mockServer.getTool('update_recipe');
      const result = await tool?.execute({
        recipeId: 'recipe-1',
        name: 'Updated Name',
      });
      
      expect(result.content[0].text).toContain('Error updating recipe: Update failed');
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
      const result = await tool?.execute({ recipeId: 'nonexistent' });
      
      expect(result.content[0].text).toContain('Error deleting recipe: Recipe with ID nonexistent not found');
    });
  });

  describe('import_recipe tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('import_recipe');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('import_recipe');
    });

    it('should import recipe from URL successfully', async () => {
      const tool = mockServer.getTool('import_recipe');
      const result = await tool?.execute({
        url: 'https://example.com/recipe',
        name: 'Custom Recipe Name',
      });
      
      expect(result.content[0].text).toContain('Successfully imported recipe "Custom Recipe Name"');
      expect(result.content[0].text).toContain('Source: example.com');
      expect(result.content[0].text).toContain('Ingredients: 1');
      expect(result.content[0].text).toContain('Steps: 2');
    });

    it('should import recipe without custom name', async () => {
      const tool = mockServer.getTool('import_recipe');
      const result = await tool?.execute({
        url: 'https://example.com/recipe',
      });
      
      expect(result.content[0].text).toContain('Successfully imported recipe "Imported Recipe"');
    });

    it('should handle import failures', async () => {
      vi.spyOn(anylistService, 'importRecipeFromUrl').mockRejectedValue(new Error('Failed to parse recipe data'));
      
      const tool = mockServer.getTool('import_recipe');
      const result = await tool?.execute({
        url: 'https://example.com/invalid-recipe',
      });
      
      expect(result.content[0].text).toContain('Error importing recipe: Failed to parse recipe data');
    });

    it('should handle network errors', async () => {
      vi.spyOn(anylistService, 'importRecipeFromUrl').mockRejectedValue(new Error('Network timeout'));
      
      const tool = mockServer.getTool('import_recipe');
      const result = await tool?.execute({
        url: 'https://unreachable.com/recipe',
      });
      
      expect(result.content[0].text).toContain('Error importing recipe: Network timeout');
    });
  });

  describe('search_recipes tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('search_recipes');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search_recipes');
    });

    it('should search recipes by multiple criteria', async () => {
      const tool = mockServer.getTool('search_recipes');
      const result = await tool?.execute({
        query: 'cookies',
        ingredients: ['flour', 'butter'],
        maxCookTime: 1200, // 20 minutes
        minRating: 4,
      });
      
      expect(result.content[0].text).toContain('Found 1 recipes matching your criteria');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
      expect(result.content[0].text).not.toContain('Pasta Carbonara');
    });

    it('should filter by cook time', async () => {
      const tool = mockServer.getTool('search_recipes');
      const result = await tool?.execute({
        maxCookTime: 600, // 10 minutes - should exclude both recipes
      });
      
      expect(result.content[0].text).toContain('No recipes found matching your criteria');
    });

    it('should filter by rating', async () => {
      const tool = mockServer.getTool('search_recipes');
      const result = await tool?.execute({
        minRating: 5, // Should only match cookies
      });
      
      expect(result.content[0].text).toContain('Found 1 recipes matching your criteria');
      expect(result.content[0].text).toContain('Chocolate Chip Cookies');
    });

    it('should handle no matches', async () => {
      const tool = mockServer.getTool('search_recipes');
      const result = await tool?.execute({
        query: 'nonexistent dish',
        minRating: 5,
        maxCookTime: 60,
      });
      
      expect(result.content[0].text).toContain('No recipes found matching your criteria');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('Search failed'));
      
      const tool = mockServer.getTool('search_recipes');
      const result = await tool?.execute({ query: 'test' });
      
      expect(result.content[0].text).toContain('Error searching recipes: Search failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle service connection errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue(new Error('Connection failed'));
      
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving recipes: Connection failed');
    });

    it('should handle unknown errors', async () => {
      vi.spyOn(anylistService, 'getRecipes').mockRejectedValue('Unknown error type');
      
      const tool = mockServer.getTool('get_recipes');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving recipes: Unknown error');
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
        'import_recipe',
        'search_recipes',
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
      expect(result.content[0].text).toContain('Prep Time: 15m');
      expect(result.content[0].text).toContain('Cook Time: 11m');
    });

    it('should format hours and minutes correctly', async () => {
      const tool = mockServer.getTool('get_recipe');
      const result = await tool?.execute({ recipeId: 'recipe-2' });
      
      // Pasta: prepTime: 600 (10 minutes), cookTime: 1200 (20 minutes)  
      expect(result.content[0].text).toContain('Prep Time: 10m');
      expect(result.content[0].text).toContain('Cook Time: 20m');
    });
  });
});