import { declareRuntimeEnv } from 'resolve-scripts'

const devConfig = {
  target: 'local',
  port: declareRuntimeEnv('PORT', '3000'),
  mode: 'development',
  rootPath: '',
  staticPath: 'static',
  staticDir: 'static',
  distDir: 'dist',
  runtime: {
    module: 'resolve-runtime-express',
    options: {},
    readModelConnectors: {
      default: {
        module: 'resolve-readmodel-lite',
        options: {
          databaseFile: 'data/read-models.db',
        },
      },
      /*
        default: {
          module: 'resolve-readmodel-mysql',
          options: {
            host: 'localhost',
            port: 3306,
            user: 'customUser',
            password: 'customPassword',
            database: 'customDatabaseName'
          }
        }
      */
    },
    eventstoreAdapter: {
      module: 'resolve-eventstore-lite',
      options: {
        databaseFile: 'data/event-store.db',
        secretsFile: 'data/secrets.db',
        snapshotBucketSize: 100,
      },
    },
  },
  backend: {
    api: {
      module: 'resolve-backend-express',
      options: {
        port: declareRuntimeEnv('PORT', '3000'),
      },
    },
    eventBroker: {
      module: 'resolve-backend-express',
      options: {
        publisherAddress: 'http://127.0.0.1:3500',
        consumerAddress: 'http://127.0.0.1:3501',
        databaseFile: 'data/local-bus-broker.db',
        upstream: true,
      },
    },
    launchBroker: true,
  },
  readModelConnectors: {
    default: {
      module: 'resolve-readmodel-lite',
      options: {
        databaseFile: 'data/read-models.db',
      },
    },
    /*
      default: {
        module: 'resolve-readmodel-mysql',
        options: {
          host: 'localhost',
          port: 3306,
          user: 'customUser',
          password: 'customPassword',
          database: 'customDatabaseName'
        }
      }
    */
  },
  eventstoreAdapter: {
    module: 'resolve-eventstore-lite',
    options: {
      databaseFile: 'data/event-store.db',
      secretsFile: 'data/secrets.db',
      snapshotBucketSize: 100,
    },
  },
  /*
    {
      module: 'resolve-eventstore-mysql',
      options: {
        host: 'localhost',
        port: 3306,
        user: 'customUser',
        password: 'customPassword',
        database: 'customDatabaseName',
        eventsTableName: 'customTableName',
        secretsDatabase: 'customSecretsDatabaseName',
        secretsTableName: 'customSecretsTableName'
      }
    }
  */ jwtCookie: {
    name: 'jwt',
    maxAge: 31536000000,
  },
}

export default devConfig
