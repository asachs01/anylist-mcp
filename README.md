# AnyList MCP Server

A Model Context Protocol (MCP) server that integrates with AnyList, enabling Claude and other MCP-compatible clients to manage grocery lists, recipes, and meal planning through natural language interactions.

## Features

### 🛒 List Management
- **Get Lists**: View all your AnyList lists with items
- **Add Items**: Add new items to any list with quantity and details
- **Update Items**: Modify item names, quantities, details, or check/uncheck status
- **Remove Items**: Delete items from lists
- **Toggle Items**: Quickly check/uncheck items
- **Bulk Operations**: Uncheck all items in a list

### 👨‍🍳 Recipe Management
- **Recipe CRUD**: Create, read, update, and delete recipes
- **Recipe Details**: Full recipe information including ingredients, instructions, prep/cook times
- **Recipe Import**: Import recipes from URLs (where supported by AnyList)
- **Recipe Collections**: Organize recipes into collections
- **Recipe Search**: Find and view specific recipes

### 📅 Meal Planning
- **Meal Events**: Create and manage meal planning events
- **Recipe Assignment**: Link recipes to specific meals
- **Daily Planning**: View meals planned for specific dates
- **Weekly Planning**: Get comprehensive weekly meal plans
- **Calendar Integration**: Schedule meals with dates and meal types

## Prerequisites

- Node.js 18.0.0 or higher
- An AnyList account with valid credentials
- Claude Desktop (for MCP integration) or another MCP-compatible client

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd anylist-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root or set these environment variables:

```bash
ANYLIST_EMAIL=your-email@example.com
ANYLIST_PASSWORD=your-password
ANYLIST_CREDENTIALS_FILE=.anylist_credentials  # Optional, defaults to .anylist_credentials
```

**Security Note**: Never commit your `.env` file or credentials to version control. The `.anylist_credentials` file is automatically added to `.gitignore`.

### Claude Desktop Integration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anylist": {
      "command": "npx",
      "args": ["tsx", "/path/to/anylist-mcp/src/index.ts"],
      "env": {
        "ANYLIST_EMAIL": "your-email@example.com",
        "ANYLIST_PASSWORD": "your-password"
      }
    }
  }
}
```

Replace `/path/to/anylist-mcp` with the actual path to your project directory.

## Usage

### Starting the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Available MCP Tools

Once connected to Claude Desktop, you can use natural language to interact with AnyList:

#### List Management Examples
- *"Show me all my AnyList lists"*
- *"Add milk and bread to my grocery list"*
- *"Check off eggs from my shopping list"*
- *"Remove bananas from the grocery list"*
- *"Uncheck all items in my weekly shopping list"*

#### Recipe Management Examples
- *"Show me all my recipes"*
- *"Create a new recipe for chocolate chip cookies"*
- *"Get the details for my lasagna recipe"*
- *"Import a recipe from this URL: https://example.com/recipe"*
- *"Add my pasta recipe to the Italian collection"*

#### Meal Planning Examples
- *"What meals do I have planned for today?"*
- *"Schedule chicken dinner for tomorrow"*
- *"Show me my meal plan for this week"*
- *"Assign my lasagna recipe to Sunday dinner"*

## Development

### Project Structure

```
src/
├── index.ts              # Main server entry point
├── services/
│   └── anylist-service.ts # AnyList API wrapper service
├── tools/                # MCP tool definitions
│   ├── list-tools.ts     # List management tools
│   ├── recipe-tools.ts   # Recipe management tools
│   └── meal-tools.ts     # Meal planning tools
├── types/
│   └── index.ts          # TypeScript type definitions
└── utils/
    └── validation.ts     # Zod validation schemas
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## API Reference

### List Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_lists` | Retrieve all lists | None |
| `add_item` | Add item to list | `listId`, `name`, `quantity?`, `details?` |
| `update_item` | Update existing item | `listId`, `itemId`, `name?`, `quantity?`, `details?`, `checked?` |
| `remove_item` | Remove item from list | `listId`, `itemId` |
| `toggle_item` | Toggle item checked status | `listId`, `itemId` |
| `uncheck_all_items` | Uncheck all items in list | `listId` |

### Recipe Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_recipes` | Get all recipes | None |
| `get_recipe` | Get specific recipe | `recipeId` |
| `create_recipe` | Create new recipe | `name`, `ingredients`, `instructions`, `servings?`, etc. |
| `update_recipe` | Update existing recipe | `recipeId`, `name?`, `ingredients?`, etc. |
| `delete_recipe` | Delete recipe | `recipeId` |
| `import_recipe_from_url` | Import from URL | `url` |

### Meal Planning Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_meal_events` | Get all meal events | None |
| `get_meal_events_by_date` | Get meals for date | `date` |
| `create_meal_event` | Create meal event | `title`, `date`, `mealType?`, `recipeId?` |
| `delete_meal_event` | Delete meal event | `eventId` |
| `get_weekly_meal_plan` | Get weekly plan | `startDate` |

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your AnyList email and password are correct
   - Check that environment variables are properly set
   - Try logging into AnyList web interface to verify credentials

2. **Connection Issues**
   - Ensure you have a stable internet connection
   - Check if AnyList services are operational
   - Verify the credentials file permissions

3. **Claude Desktop Integration**
   - Ensure the path to the project is correct in the configuration
   - Check that Node.js and npm are in your PATH
   - Restart Claude Desktop after configuration changes

### Debug Mode

Set the `DEBUG` environment variable to enable verbose logging:

```bash
DEBUG=anylist-mcp npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Update the CHANGELOG.md
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FastMCP](https://github.com/punkpeye/fastmcp) - TypeScript MCP framework
- [AnyList API](https://github.com/codetheweb/anylist) - Unofficial AnyList API wrapper
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol specification 