# API Rate Limiting Proxy Service

A proxy service that handles rate limiting for third-party APIs. This service acts as an intermediary layer between clients and their target APIs, managing rate limits transparently.

## Features

- API Key Management
- Application Registration
- Proxy Functionality
- Rate Limit Handling with multiple strategies:
  - Fixed Window
  - Sliding Window
  - Token Bucket

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/lokesh1jha/API-Rate-Limiting.git
cd API-Rate-Limiting
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/api_rate_limiter?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Rate Limiting
DEFAULT_RATE_LIMIT_WINDOW=15
DEFAULT_RATE_LIMIT_MAX_REQUESTS=100
```

#Redis
REDIS_URL=redis://127.0.0.1:6379

4. Set up the database:
```bash
npx prisma migrate dev
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Prometheus

Prometheus is configured to scrape metrics from the application. The configuration is located in the `prometheus.yml` file.

To start Prometheus, run the following command:
```bash
prometheus --config.file=prometheus.yml
```

# Grafana

Visit `https://grafana.com/grafana/download?platform=linux` to download Grafana. and follow the instructions to install  and run the Grafana.

Login using `admin` and `admin`.

Add Prometheus as a data source.



## Folder structure

```
api-rate-limiter/
├── node_modules/
├── prisma/
├── src/
│   ├── lib/
│   │   └── prisma/        # Prisma client
│   ├── middleware/       # Custom middleware
│   │   └── auth/        # Authentication middleware
│   ├── routes/          # API routes
│   │   ├── apps/       # API services
│   │   └── auth/       # Authentication services
│   ├── services/        # Business logic
│   │   ├── proxyservice/      # Proxy services
│   │   └── ratelimitservice/  # Rate limiting services
│   ├── utils/          # Utility functions
│   │   ├── apikey/      # API key services
│   └── index.ts          # Main application file
├── .env               # Environment variables
├── .gitignore        # Git ignore file
├── package.json      # Project dependencies
├── tsconfig.json     # TypeScript configuration
└── README.md         # Project documentation
```


## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/api-key` - Get API key

### Application Management

- `POST /apps` - Register a new API
- `GET /apps` - Get all registered APIs
- `GET /apps/:id` - Get specific API details
- `PUT /apps/:id` - Update API configuration
- `DELETE /apps/:id` - Delete API

### Proxy

- `ANY /apis/:appId/*` - Proxy requests to registered APIs

## Rate Limiting Strategies

### Fixed Window
- Simple time-based window
- Resets after the window period
- Example: 100 requests per 15 minutes

### Sliding Window
- Rolling time window
- More accurate than fixed window
- Example: 100 requests in any 15-minute period

### Token Bucket
- Token-based rate limiting
- Smooths out request bursts
- Example: 100 tokens, 10 tokens per second

## Security

- API key authentication
- JWT for user sessions
- Secure password hashing
- Rate limiting per API key
- Input validation

## Error Handling

The service includes comprehensive error handling for:
- Invalid API keys
- Rate limit exceeded
- Invalid requests
- Database errors
- Network issues

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## API Examples

### Authentication

1. Register a new user:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

2. Login:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

3. Get API Key:
```bash
curl -X GET http://localhost:3000/auth/api-key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Application Management

1. Register a new API:
```bash
curl -X POST http://localhost:3000/apps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test API",
    "baseUrl": "https://api.example.com",
    "rateLimitStrategy": "FIXED_WINDOW",
    "requestCount": 100,
    "timeWindow": 900,
    "additionalConfig": {
      "timeout": 5000,
      "retryCount": 3
    }
  }'
```

2. Get all registered APIs:
```bash
curl -X GET http://localhost:3000/apps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. Get specific API details:
```bash
curl -X GET http://localhost:3000/apps/APP_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

4. Update API configuration:
```bash
curl -X PUT http://localhost:3000/apps/APP_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "requestCount": 200,
    "timeWindow": 1800
  }'
```

5. Delete API:
```bash
curl -X DELETE http://localhost:3000/apps/APP_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Proxy Requests

1. Forward GET request:
```bash
curl -X GET http://localhost:3000/apis/APP_ID/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. Forward POST request:
```bash
curl -X POST http://localhost:3000/apis/APP_ID/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com"
  }'
```

3. Forward PUT request:
```bash
curl -X PUT http://localhost:3000/apis/APP_ID/users/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe Updated"
  }'
```

4. Forward DELETE request:
```bash
curl -X DELETE http://localhost:3000/apis/APP_ID/users/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Analytics and Metrics

1. Get Analytics Count:
```bash
curl --location 'http://localhost:3000/analytics/analytics?timeframe=2h' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

Response:
```{
    "totalRequests": 11,
    "errorCount": 4,
    "averageProcessingTime": 16428.272727272728,
    "priorityDistribution": {
        "0": 11
    }
}
```


2. Get rate limit violations:
```bash
curl --location 'http://localhost:3000/analytics/user?timeframe=2h' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

Reposne
```
[
    {
        "id": 4,
        "timestamp": "2025-04-07T13:41:11.245Z",
        "endpoint": "/test",
        "status": 429,
        "processingTime": 3044,
        "priority": "normal",
        "userId": "2c146bb5-805f-4d74-8589-21a6d0c80d4e",
        "createdAt": "2025-04-07T13:41:13.340Z"
    },
    {
        "id": 3,
        "timestamp": "2025-04-07T13:40:35.674Z",
        "endpoint": "/test",
        "status": 429,
        "processingTime": 3737,
        "priority": "normal",
        "userId": "2c146bb5-805f-4d74-8589-21a6d0c80d4e",
        "createdAt": "2025-04-07T13:40:35.676Z"
    },
    {
        "id": 2,
        "timestamp": "2025-04-07T13:38:41.896Z",
        "endpoint": "/test",
        "status": 200,
        "processingTime": 8483,
        "priority": "normal",
        "userId": "2c146bb5-805f-4d74-8589-21a6d0c80d4e",
        "createdAt": "2025-04-07T13:38:41.898Z"
    },
    {
        "id": 1,
        "timestamp": "2025-04-07T13:38:09.765Z",
        "endpoint": "/test",
        "status": 200,
        "processingTime": 4323,
        "priority": "normal",
        "userId": "2c146bb5-805f-4d74-8589-21a6d0c80d4e",
        "createdAt": "2025-04-07T13:38:09.767Z"
    }
]
```
