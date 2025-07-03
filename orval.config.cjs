module.exports = {
  zod: {
    input: './public/openapi.yaml',
    output: {
      client: 'zod',
      target: './src/types/generated/zod.ts',
      schemas: './src/types/generated',
      prettier: true,
      override: {
        zod: {
          strict: {
            query: true,
            param: true,
            header: true,
            body: true,
          },
          generate: {
            response: false
          }
        },
      },
    },
  },
};