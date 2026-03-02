import { vi } from 'vitest';
import type { 
  ListInfo, 
  ItemInfo, 
  RecipeInfo, 
  MealEventInfo 
} from '../../src/types/index.js';

/**
 * Mock AnyList client responses and data
 */

// Mock data
export const mockLists: ListInfo[] = [
  {
    identifier: 'list-1',
    parentId: null,
    name: 'Grocery List',
    items: [
      {
        listId: 'list-1',
        identifier: 'item-1',
        name: 'Milk',
        details: '2% fat',
        quantity: '1 gallon',
        checked: false,
        manualSortIndex: 0,
        userId: 'user-1',
        categoryMatchId: 'dairy-1',
      },
      {
        listId: 'list-1',
        identifier: 'item-2',
        name: 'Bread',
        details: 'Whole wheat',
        quantity: '1 loaf',
        checked: true,
        manualSortIndex: 1,
        userId: 'user-1',
        categoryMatchId: 'bakery-1',
      },
    ],
  },
  {
    identifier: 'list-2',
    parentId: null,
    name: 'Shopping List',
    items: [
      {
        listId: 'list-2',
        identifier: 'item-3',
        name: 'Shampoo',
        details: 'For dry hair',
        quantity: '1 bottle',
        checked: false,
        manualSortIndex: 0,
        userId: 'user-1',
        categoryMatchId: 'personal-care-1',
      },
    ],
  },
];

export const mockRecipes: RecipeInfo[] = [
  {
    identifier: 'recipe-1',
    timestamp: Date.now() / 1000,
    name: 'Chocolate Chip Cookies',
    note: 'Classic homemade cookies',
    sourceName: 'Family Recipe',
    sourceUrl: undefined,
    ingredients: [
      {
        rawIngredient: '2 cups all-purpose flour',
        name: 'All-purpose flour',
        quantity: '2 cups',
      },
      {
        rawIngredient: '1 tsp baking soda',
        name: 'Baking soda',
        quantity: '1 tsp',
      },
      {
        rawIngredient: '1 cup butter, softened',
        name: 'Butter',
        quantity: '1 cup',
        note: 'softened',
      },
    ],
    preparationSteps: [
      'Preheat oven to 375°F',
      'Mix dry ingredients in a bowl',
      'Cream butter and sugars',
      'Combine wet and dry ingredients',
      'Drop onto baking sheet',
      'Bake for 9-11 minutes',
    ],
    instructions: [
      'Preheat oven to 375°F',
      'Mix dry ingredients in a bowl',
      'Cream butter and sugars',
      'Combine wet and dry ingredients',
      'Drop onto baking sheet',
      'Bake for 9-11 minutes',
    ],
    photoIds: [],
    adCampaignId: undefined,
    photoUrls: [],
    scaleFactor: 1,
    rating: 5,
    creationTimestamp: Date.now() / 1000 - 86400,
    nutritionalInfo: undefined,
    cookTime: 660, // 11 minutes
    prepTime: 900, // 15 minutes
    servings: '24 cookies',
    paprikaIdentifier: undefined,
  },
  {
    identifier: 'recipe-2',
    timestamp: Date.now() / 1000,
    name: 'Pasta Carbonara',
    note: 'Traditional Italian dish',
    sourceName: 'Italian Cookbook',
    sourceUrl: 'https://example.com/carbonara',
    ingredients: [
      {
        rawIngredient: '1 lb spaghetti',
        name: 'Spaghetti',
        quantity: '1 lb',
      },
      {
        rawIngredient: '6 oz pancetta, diced',
        name: 'Pancetta',
        quantity: '6 oz',
        note: 'diced',
      },
      {
        rawIngredient: '4 large eggs',
        name: 'Eggs',
        quantity: '4 large',
      },
    ],
    preparationSteps: [
      'Cook pasta according to package directions',
      'Cook pancetta until crispy',
      'Beat eggs with cheese',
      'Toss hot pasta with egg mixture',
      'Serve immediately',
    ],
    instructions: [
      'Cook pasta according to package directions',
      'Cook pancetta until crispy',
      'Beat eggs with cheese',
      'Toss hot pasta with egg mixture',
      'Serve immediately',
    ],
    photoIds: ['photo-1'],
    adCampaignId: undefined,
    photoUrls: ['https://example.com/photo1.jpg'],
    scaleFactor: 1,
    rating: 4,
    creationTimestamp: Date.now() / 1000 - 172800,
    nutritionalInfo: 'High protein',
    cookTime: 1200, // 20 minutes
    prepTime: 600, // 10 minutes
    servings: '4 servings',
    paprikaIdentifier: undefined,
  },
];

export const mockMealEvents: MealEventInfo[] = [
  {
    identifier: 'meal-1',
    calendarId: 'calendar-1',
    date: new Date('2024-01-15'),
    details: 'Dinner for family',
    labelId: 'label-1',
    label: 'Dinner',
    logicalTimestamp: Date.now(),
    orderAddedSortIndex: 0,
    recipeId: 'recipe-2',
    recipe: mockRecipes[1],
    recipeScaleFactor: 1,
    title: 'Pasta Night',
  },
  {
    identifier: 'meal-2',
    calendarId: 'calendar-1',
    date: new Date('2024-01-16'),
    details: 'Lunch with friends',
    labelId: 'label-2',
    label: 'Lunch',
    logicalTimestamp: Date.now(),
    orderAddedSortIndex: 1,
    recipeId: undefined,
    recipe: undefined,
    recipeScaleFactor: 1,
    title: 'Sandwich Day',
  },
];

// Helper to add save method to item objects
function ensureItemMethods(item: any) {
  if (!item.save) {
    item.save = vi.fn(async () => item);
  }
  return item;
}

// Helper to add mock methods to recipe objects
function withRecipeMethods(recipe: any) {
  recipe.save = recipe.save || vi.fn(async () => recipe);
  recipe.delete = recipe.delete || vi.fn(async () => {});
  return recipe;
}

// Helper to add mock methods to event objects
function withEventMethods(event: any) {
  event.save = event.save || vi.fn(async () => event);
  event.delete = event.delete || vi.fn(async () => {});
  return event;
}

// Mock AnyList client
export class MockAnyListClient {
  lists = mockLists;
  recipes = mockRecipes.map(withRecipeMethods);
  mealPlanningCalendarEvents = mockMealEvents.map(withEventMethods);
  recipeDataId = 'recipe-data-1';
  uid = 'user-1';
  calendarId = 'calendar-1';

  async login() {
    return Promise.resolve();
  }

  async getLists() {
    // Ensure all items have save methods
    for (const list of this.lists) {
      list.items.forEach(ensureItemMethods);
    }
    return Promise.resolve(this.lists);
  }

  async getRecipes() {
    this.recipes = mockRecipes.map(withRecipeMethods);
    return Promise.resolve(this.recipes);
  }

  async getMealPlanningCalendarEvents() {
    this.mealPlanningCalendarEvents = mockMealEvents.map(withEventMethods);
    return Promise.resolve(this.mealPlanningCalendarEvents);
  }

  async _getUserData(_refreshCache?: boolean) {
    return {
      recipeDataResponse: {
        recipeCollections: [
          {
            identifier: 'collection-1',
            timestamp: Date.now() / 1000,
            name: 'Favorites',
            recipeIds: ['recipe-1'],
          },
        ],
      },
    };
  }

  private _listWrappers: Map<string, any> = new Map();

  getListById(id: string) {
    const list = this.lists.find(l => l.identifier === id);
    if (!list) return null;

    // Return the same wrapper object for the same list ID so spies persist
    if (this._listWrappers.has(id)) return this._listWrappers.get(id);

    const wrapper = {
      ...list,
      get items() { return list.items; },
      addItem: vi.fn(async (item: any) => {
        const newItem = {
          ...item,
          listId: id,
          identifier: `item-${Date.now()}`,
          checked: false,
          manualSortIndex: list.items.length,
          userId: 'user-1',
          categoryMatchId: 'category-1',
          save: vi.fn(async () => newItem),
        };
        list.items.push(newItem);
        return newItem;
      }),
      getItemById: (itemId: string) => {
        const item = list.items.find(i => i.identifier === itemId);
        if (!item) return null;

        ensureItemMethods(item);
        return item;
      },
    };
    this._listWrappers.set(id, wrapper);
    return wrapper;
  }

  createItem(data: any) {
    return {
      ...data,
      identifier: `item-${Date.now()}`,
      checked: false,
      manualSortIndex: 0,
      userId: 'user-1',
      categoryMatchId: 'category-1',
    };
  }

  async createRecipe(data: any) {
    const recipe = {
      ...data,
      identifier: `recipe-${Date.now()}`,
      timestamp: Date.now() / 1000,
      photoIds: [],
      photoUrls: [],
      save: vi.fn(async () => {
        this.recipes.push(recipe);
        return recipe;
      }),
      delete: vi.fn(async () => {
        const index = this.recipes.findIndex((r: any) => r.identifier === recipe.identifier);
        if (index >= 0) this.recipes.splice(index, 1);
      }),
    };
    return recipe;
  }

  async createEvent(data: any) {
    const event = {
      ...data,
      identifier: `meal-${Date.now()}`,
      calendarId: 'calendar-1',
      logicalTimestamp: Date.now(),
      orderAddedSortIndex: this.mealPlanningCalendarEvents.length,
      save: vi.fn(async () => {
        this.mealPlanningCalendarEvents.push(event);
        return event;
      }),
      delete: vi.fn(async () => {
        const index = this.mealPlanningCalendarEvents.findIndex((e: any) => e.identifier === event.identifier);
        if (index >= 0) this.mealPlanningCalendarEvents.splice(index, 1);
      }),
    };
    return event;
  }

  createRecipeCollection(data: any) {
    const collection = {
      ...data,
      identifier: data.identifier || `collection-${Date.now()}`,
      timestamp: data.timestamp || Date.now() / 1000,
      recipeIds: data.recipeIds || [],
      save: vi.fn(async () => collection),
      delete: vi.fn(async () => {}),
      addRecipe: vi.fn(async (recipeId: string) => {
        collection.recipeIds.push(recipeId);
      }),
      removeRecipe: vi.fn(async (recipeId: string) => {
        const idx = collection.recipeIds.indexOf(recipeId);
        if (idx >= 0) collection.recipeIds.splice(idx, 1);
      }),
    };
    return collection;
  }

  teardown() {
    // Cleanup mock
  }
}

// Factory function to create mock client
export function createMockAnyListClient(): MockAnyListClient {
  return new MockAnyListClient();
}

// Mock the entire anylist module
export const mockAnyListModule = {
  __esModule: true,
  default: vi.fn(() => new MockAnyListClient()),
};

// Reset all mock data to initial state
export function resetMockData() {
  mockLists.length = 0;
  mockLists.push(...[
    {
      identifier: 'list-1',
      parentId: null,
      name: 'Grocery List',
      items: [
        {
          listId: 'list-1',
          identifier: 'item-1',
          name: 'Milk',
          details: '2% fat',
          quantity: '1 gallon',
          checked: false,
          manualSortIndex: 0,
          userId: 'user-1',
          categoryMatchId: 'dairy-1',
        },
        {
          listId: 'list-1',
          identifier: 'item-2',
          name: 'Bread',
          details: 'Whole wheat',
          quantity: '1 loaf',
          checked: true,
          manualSortIndex: 1,
          userId: 'user-1',
          categoryMatchId: 'bakery-1',
        },
      ],
    },
    {
      identifier: 'list-2',
      parentId: null,
      name: 'Shopping List',
      items: [
        {
          listId: 'list-2',
          identifier: 'item-3',
          name: 'Shampoo',
          details: 'For dry hair',
          quantity: '1 bottle',
          checked: false,
          manualSortIndex: 0,
          userId: 'user-1',
          categoryMatchId: 'personal-care-1',
        },
      ],
    },
  ]);
  
  mockRecipes.length = 0;
  mockRecipes.push(...[
    {
      identifier: 'recipe-1',
      timestamp: Date.now() / 1000,
      name: 'Chocolate Chip Cookies',
      note: 'Classic homemade cookies',
      sourceName: 'Family Recipe',
      sourceUrl: undefined,
      ingredients: [
        {
          rawIngredient: '2 cups all-purpose flour',
          name: 'All-purpose flour',
          quantity: '2 cups',
        },
        {
          rawIngredient: '1 tsp baking soda',
          name: 'Baking soda',
          quantity: '1 tsp',
        },
        {
          rawIngredient: '1 cup butter, softened',
          name: 'Butter',
          quantity: '1 cup',
          note: 'softened',
        },
      ],
      preparationSteps: [
        'Preheat oven to 375°F',
        'Mix dry ingredients in a bowl',
        'Cream butter and sugars',
        'Combine wet and dry ingredients',
        'Drop onto baking sheet',
        'Bake for 9-11 minutes',
      ],
      instructions: [
        'Preheat oven to 375°F',
        'Mix dry ingredients in a bowl',
        'Cream butter and sugars',
        'Combine wet and dry ingredients',
        'Drop onto baking sheet',
        'Bake for 9-11 minutes',
      ],
      photoIds: [],
      adCampaignId: undefined,
      photoUrls: [],
      scaleFactor: 1,
      rating: 5,
      creationTimestamp: Date.now() / 1000 - 86400,
      nutritionalInfo: undefined,
      cookTime: 660,
      prepTime: 900,
      servings: '24 cookies',
      paprikaIdentifier: undefined,
    },
    {
      identifier: 'recipe-2',
      timestamp: Date.now() / 1000,
      name: 'Pasta Carbonara',
      note: 'Traditional Italian dish',
      sourceName: 'Italian Cookbook',
      sourceUrl: 'https://example.com/carbonara',
      ingredients: [
        {
          rawIngredient: '1 lb spaghetti',
          name: 'Spaghetti',
          quantity: '1 lb',
        },
        {
          rawIngredient: '6 oz pancetta, diced',
          name: 'Pancetta',
          quantity: '6 oz',
          note: 'diced',
        },
        {
          rawIngredient: '4 large eggs',
          name: 'Eggs',
          quantity: '4 large',
        },
      ],
      preparationSteps: [
        'Cook pasta according to package directions',
        'Cook pancetta until crispy',
        'Beat eggs with cheese',
        'Toss hot pasta with egg mixture',
        'Serve immediately',
      ],
      instructions: [
        'Cook pasta according to package directions',
        'Cook pancetta until crispy',
        'Beat eggs with cheese',
        'Toss hot pasta with egg mixture',
        'Serve immediately',
      ],
      photoIds: ['photo-1'],
      adCampaignId: undefined,
      photoUrls: ['https://example.com/photo1.jpg'],
      scaleFactor: 1,
      rating: 4,
      creationTimestamp: Date.now() / 1000 - 172800,
      nutritionalInfo: 'High protein',
      cookTime: 1200,
      prepTime: 600,
      servings: '4 servings',
      paprikaIdentifier: undefined,
    },
  ]);
  
  mockMealEvents.length = 0;
  mockMealEvents.push(...[
    {
      identifier: 'meal-1',
      calendarId: 'calendar-1',
      date: new Date('2024-01-15'),
      details: 'Dinner for family',
      labelId: 'label-1',
      label: 'Dinner',
      logicalTimestamp: Date.now(),
      orderAddedSortIndex: 0,
      recipeId: 'recipe-2',
      recipe: mockRecipes[1],
      recipeScaleFactor: 1,
      title: 'Pasta Night',
    },
    {
      identifier: 'meal-2',
      calendarId: 'calendar-1',
      date: new Date('2024-01-16'),
      details: 'Lunch with friends',
      labelId: 'label-2',
      label: 'Lunch',
      logicalTimestamp: Date.now(),
      orderAddedSortIndex: 1,
      recipeId: undefined,
      recipe: undefined,
      recipeScaleFactor: 1,
      title: 'Sandwich Day',
    },
  ]);
}