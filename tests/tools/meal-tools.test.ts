import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnyListService } from '../../src/services/anylist-service.js';
import { registerMealTools } from '../../src/tools/meal-tools.js';
import { createMockFastMCP } from '../mocks/fastmcp-mock.js';
import { mockMealEvents, mockRecipes, resetMockData } from '../mocks/anylist-mock.js';
import type { AnyListConfig, CreateMealEventRequest } from '../../src/types/index.js';

// Mock the AnyList module
vi.mock('anylist', () => ({
  default: vi.fn(() => ({
    login: vi.fn(),
    getMealEvents: vi.fn(),
    mealEvents: mockMealEvents,
    teardown: vi.fn(),
  })),
}));

describe('Meal Tools', () => {
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
    vi.spyOn(anylistService, 'getMealEvents').mockImplementation(async (startDate?: string, endDate?: string) => {
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
    
    vi.spyOn(anylistService, 'getMealEvent').mockImplementation(async (eventId: string) => {
      const event = mockMealEvents.find(e => e.identifier === eventId);
      return event || null;
    });
    
    vi.spyOn(anylistService, 'createMealEvent').mockImplementation(async (request: CreateMealEventRequest) => {
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
    
    vi.spyOn(anylistService, 'deleteMealEvent').mockImplementation(async (eventId: string) => {
      const index = mockMealEvents.findIndex(e => e.identifier === eventId);
      if (index === -1) {
        throw new Error(`Meal event with ID ${eventId} not found`);
      }
      
      // Note: AnyList API doesn't support deletion, so we simulate it for testing
      mockMealEvents.splice(index, 1);
    });
    
    // Register tools
    registerMealTools(mockServer, anylistService);
  });

  describe('get_meal_events tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_meal_events');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_meal_events');
    });

    it('should retrieve all meal events', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({ includeRecipes: true });
      
      expect(result.content[0].text).toContain('Found 2 meal events');
      expect(result.content[0].text).toContain('**Pasta Night**');
      expect(result.content[0].text).toContain('**Sandwich Day**');
      expect(result.content[0].text).toContain('2024-01-15');
      expect(result.content[0].text).toContain('2024-01-16');
      expect(result.content[0].text).toContain('Recipe ID: recipe-2');
    });

    it('should retrieve meal events without recipes', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({ includeRecipes: false });
      
      expect(result.content[0].text).toContain('Found 2 meal events');
      expect(result.content[0].text).toContain('**Pasta Night**');
      expect(result.content[0].text).not.toContain('Recipe ID:');
    });

    it('should filter by date range', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        includeRecipes: true,
      });
      
      expect(result.content[0].text).toContain('Found 1 meal events');
      expect(result.content[0].text).toContain('**Pasta Night**');
      expect(result.content[0].text).not.toContain('**Sandwich Day**');
    });

    it('should filter by start date only', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({
        startDate: '2024-01-16',
        includeRecipes: true,
      });
      
      expect(result.content[0].text).toContain('Found 1 meal events');
      expect(result.content[0].text).toContain('**Sandwich Day**');
      expect(result.content[0].text).not.toContain('**Pasta Night**');
    });

    it('should filter by end date only', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({
        endDate: '2024-01-15',
        includeRecipes: true,
      });
      
      expect(result.content[0].text).toContain('Found 1 meal events');
      expect(result.content[0].text).toContain('**Pasta Night**');
      expect(result.content[0].text).not.toContain('**Sandwich Day**');
    });

    it('should handle empty results', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({
        startDate: '2024-01-17',
        endDate: '2024-01-17',
      });
      
      expect(result.content[0].text).toContain('No meal events found for the specified date range');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getMealEvents').mockRejectedValue(new Error('API Error'));
      
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving meal events: API Error');
    });
  });

  describe('get_meal_event tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_meal_event');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_meal_event');
    });

    it('should retrieve specific meal event', async () => {
      const tool = mockServer.getTool('get_meal_event');
      const result = await tool?.execute({ eventId: 'meal-1' });
      
      expect(result.content[0].text).toContain('**Pasta Night**');
      expect(result.content[0].text).toContain('Date: 2024-01-15');
      expect(result.content[0].text).toContain('Details: Dinner for family');
      expect(result.content[0].text).toContain('Recipe: Pasta Carbonara');
      expect(result.content[0].text).toContain('Scale Factor: 1x');
    });

    it('should handle meal event without recipe', async () => {
      const tool = mockServer.getTool('get_meal_event');
      const result = await tool?.execute({ eventId: 'meal-2' });
      
      expect(result.content[0].text).toContain('**Sandwich Day**');
      expect(result.content[0].text).toContain('Date: 2024-01-16');
      expect(result.content[0].text).toContain('Details: Lunch with friends');
      expect(result.content[0].text).toContain('Recipe: No recipe assigned');
    });

    it('should handle event not found', async () => {
      const tool = mockServer.getTool('get_meal_event');
      const result = await tool?.execute({ eventId: 'nonexistent' });
      
      expect(result.content[0].text).toContain('Meal event with ID nonexistent not found');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getMealEvent').mockRejectedValue(new Error('Retrieval failed'));
      
      const tool = mockServer.getTool('get_meal_event');
      const result = await tool?.execute({ eventId: 'meal-1' });
      
      expect(result.content[0].text).toContain('Error retrieving meal event: Retrieval failed');
    });
  });

  describe('create_meal_event tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('create_meal_event');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_meal_event');
    });

    it('should create meal event with recipe', async () => {
      const tool = mockServer.getTool('create_meal_event');
      const result = await tool?.execute({
        title: 'Taco Tuesday',
        date: '2024-01-20',
        details: 'Family dinner',
        recipeId: 'recipe-1',
        recipeScaleFactor: 2,
      });
      
      expect(result.content[0].text).toContain('Successfully created meal event "Taco Tuesday"');
      expect(result.content[0].text).toContain('Date: 2024-01-20');
      expect(result.content[0].text).toContain('Recipe: Chocolate Chip Cookies (2x scale)');
    });

    it('should create meal event without recipe', async () => {
      const tool = mockServer.getTool('create_meal_event');
      const result = await tool?.execute({
        title: 'Pizza Night',
        date: '2024-01-21',
        details: 'Ordering pizza',
      });
      
      expect(result.content[0].text).toContain('Successfully created meal event "Pizza Night"');
      expect(result.content[0].text).toContain('Date: 2024-01-21');
      expect(result.content[0].text).toContain('Recipe: No recipe assigned');
    });

    it('should handle invalid recipe ID', async () => {
      vi.spyOn(anylistService, 'createMealEvent').mockImplementation(async (request) => {
        if (request.recipeId === 'invalid-recipe') {
          throw new Error('Recipe not found');
        }
        
        return {
          identifier: `meal-${Date.now()}`,
          calendarId: 'calendar-1',
          date: new Date(request.date),
          details: request.details,
          labelId: 'label-1',
          label: 'Meal',
          logicalTimestamp: Date.now(),
          orderAddedSortIndex: mockMealEvents.length,
          recipeId: request.recipeId,
          recipe: undefined,
          recipeScaleFactor: request.recipeScaleFactor || 1,
          title: request.title,
        };
      });
      
      const tool = mockServer.getTool('create_meal_event');
      const result = await tool?.execute({
        title: 'Test Event',
        date: '2024-01-22',
        recipeId: 'invalid-recipe',
      });
      
      expect(result.content[0].text).toContain('Error creating meal event: Recipe not found');
    });

    it('should handle invalid date', async () => {
      const tool = mockServer.getTool('create_meal_event');
      const result = await tool?.execute({
        title: 'Test Event',
        date: 'invalid-date',
      });
      
      expect(result.content[0].text).toContain('Error creating meal event');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'createMealEvent').mockRejectedValue(new Error('Creation failed'));
      
      const tool = mockServer.getTool('create_meal_event');
      const result = await tool?.execute({
        title: 'Test Event',
        date: '2024-01-22',
      });
      
      expect(result.content[0].text).toContain('Error creating meal event: Creation failed');
    });
  });

  describe('delete_meal_event tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('delete_meal_event');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('delete_meal_event');
    });

    it('should delete meal event successfully', async () => {
      const tool = mockServer.getTool('delete_meal_event');
      const result = await tool?.execute({ eventId: 'meal-1' });

      expect(result.content[0].text).toContain('Successfully deleted meal event');
    });

    it('should handle event not found', async () => {
      const tool = mockServer.getTool('delete_meal_event');
      const result = await tool?.execute({ eventId: 'nonexistent' });
      
      expect(result.content[0].text).toContain('Error deleting meal event: Meal event with ID nonexistent not found');
    });
  });

  describe('get_weekly_meal_plan tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('get_weekly_meal_plan');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_weekly_meal_plan');
    });

    it('should get weekly meal plan', async () => {
      const tool = mockServer.getTool('get_weekly_meal_plan');
      const result = await tool?.execute({
        startDate: '2024-01-15',
      });
      
      expect(result.content[0].text).toContain('Weekly Meal Plan');
      expect(result.content[0].text).toContain('Week of 2024-01-15');
      expect(result.content[0].text).toContain('**Monday (2024-01-15)**');
      expect(result.content[0].text).toContain('- Pasta Night');
      expect(result.content[0].text).toContain('**Tuesday (2024-01-16)**');
      expect(result.content[0].text).toContain('- Sandwich Day');
    });

    it('should handle empty week', async () => {
      const tool = mockServer.getTool('get_weekly_meal_plan');
      const result = await tool?.execute({
        startDate: '2024-01-22', // Week with no events
      });
      
      expect(result.content[0].text).toContain('Weekly Meal Plan');
      expect(result.content[0].text).toContain('Week of 2024-01-22');
      expect(result.content[0].text).toContain('No meal events scheduled');
    });

    it('should handle service errors', async () => {
      vi.spyOn(anylistService, 'getMealEvents').mockRejectedValue(new Error('Failed to get events'));
      
      const tool = mockServer.getTool('get_weekly_meal_plan');
      const result = await tool?.execute({
        startDate: '2024-01-15',
      });
      
      expect(result.content[0].text).toContain('Error retrieving weekly meal plan: Failed to get events');
    });
  });

  describe('plan_meals_from_recipes tool', () => {
    it('should be registered', () => {
      const tool = mockServer.getTool('plan_meals_from_recipes');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('plan_meals_from_recipes');
    });

    it('should plan meals from multiple recipes', async () => {
      const tool = mockServer.getTool('plan_meals_from_recipes');
      const result = await tool?.execute({
        startDate: '2024-01-25',
        recipeIds: ['recipe-1', 'recipe-2'],
        mealTypes: ['Breakfast', 'Dinner'],
      });
      
      expect(result.content[0].text).toContain('Successfully planned 2 meals');
      expect(result.content[0].text).toContain('Breakfast - Chocolate Chip Cookies');
      expect(result.content[0].text).toContain('Dinner - Pasta Carbonara');
      expect(result.content[0].text).toContain('2024-01-25');
      expect(result.content[0].text).toContain('2024-01-26');
    });

    it('should handle mismatched arrays', async () => {
      const tool = mockServer.getTool('plan_meals_from_recipes');
      const result = await tool?.execute({
        startDate: '2024-01-25',
        recipeIds: ['recipe-1', 'recipe-2'],
        mealTypes: ['Breakfast'], // Only one meal type for two recipes
      });
      
      expect(result.content[0].text).toContain('Number of recipe IDs must match number of meal types');
    });

    it('should handle empty arrays', async () => {
      const tool = mockServer.getTool('plan_meals_from_recipes');
      const result = await tool?.execute({
        startDate: '2024-01-25',
        recipeIds: [],
        mealTypes: [],
      });
      
      expect(result.content[0].text).toContain('At least one recipe and meal type must be provided');
    });

    it('should handle creation failures', async () => {
      let callCount = 0;
      vi.spyOn(anylistService, 'createMealEvent').mockImplementation(async (request) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Creation failed for second meal');
        }
        
        return {
          identifier: `meal-${Date.now()}-${callCount}`,
          calendarId: 'calendar-1',
          date: new Date(request.date),
          details: request.details,
          labelId: 'label-1',
          label: 'Meal',
          logicalTimestamp: Date.now(),
          orderAddedSortIndex: mockMealEvents.length,
          recipeId: request.recipeId,
          recipe: mockRecipes.find(r => r.identifier === request.recipeId),
          recipeScaleFactor: request.recipeScaleFactor || 1,
          title: request.title,
        };
      });
      
      const tool = mockServer.getTool('plan_meals_from_recipes');
      const result = await tool?.execute({
        startDate: '2024-01-25',
        recipeIds: ['recipe-1', 'recipe-2'],
        mealTypes: ['Breakfast', 'Dinner'],
      });
      
      expect(result.content[0].text).toContain('Planned 1 out of 2 meals successfully');
      expect(result.content[0].text).toContain('✓ 2024-01-25 - Breakfast');
      expect(result.content[0].text).toContain('✗ 2024-01-26 - Dinner');
      expect(result.content[0].text).toContain('Creation failed for second meal');
    });
  });

  describe('Error Handling', () => {
    it('should handle service connection errors', async () => {
      vi.spyOn(anylistService, 'getMealEvents').mockRejectedValue(new Error('Connection failed'));
      
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving meal events: Connection failed');
    });

    it('should handle unknown errors', async () => {
      vi.spyOn(anylistService, 'getMealEvents').mockRejectedValue('Unknown error type');
      
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({});
      
      expect(result.content[0].text).toContain('Error retrieving meal events: Unknown error');
    });

    it('should handle null responses gracefully', async () => {
      vi.spyOn(anylistService, 'getMealEvents').mockResolvedValue(null as any);
      
      const tool = mockServer.getTool('get_meal_events');
      
      await expect(tool?.execute({})).rejects.toThrow();
    });
  });

  describe('Date Handling', () => {
    it('should handle various date formats', async () => {
      const tool = mockServer.getTool('create_meal_event');
      
      // Test ISO date
      const result1 = await tool?.execute({
        title: 'Test Event 1',
        date: '2024-01-20T12:00:00.000Z',
      });
      expect(result1.content[0].text).toContain('Successfully created');
      
      // Test simple date
      const result2 = await tool?.execute({
        title: 'Test Event 2',
        date: '2024-01-21',
      });
      expect(result2.content[0].text).toContain('Successfully created');
    });

    it('should handle timezone considerations', async () => {
      const tool = mockServer.getTool('get_meal_events');
      const result = await tool?.execute({
        startDate: '2024-01-15T00:00:00.000Z',
        endDate: '2024-01-15T23:59:59.999Z',
      });
      
      expect(result.content[0].text).toContain('Found 1 meal events');
      expect(result.content[0].text).toContain('Pasta Night');
    });
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', () => {
      const expectedTools = [
        'get_meal_events',
        'get_meal_event',
        'create_meal_event',
        'delete_meal_event',
        'get_weekly_meal_plan',
        'plan_meals_from_recipes',
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