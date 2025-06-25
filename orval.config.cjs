module.exports = {
  // Generate TypeScript types only
  // typescript: {
  //   input: './openapi.yaml',
  //   output: {
  //     schemas: './src/types/schemas',
  //   },
  // },
  zod: {
    input: './openapi.yaml',
    output: {
      client: 'zod',
      mode: 'split',
      target: './src/types/generated/zod.ts',
      schemas: './src/types/generated',
      override: {
        zod: {
          generateEachHttpStatus: false,
          strict: {
            response: true,
            query: true,
            param: true,
            header: true,
            body: true,
          },
        },
      },
    },
  },
};