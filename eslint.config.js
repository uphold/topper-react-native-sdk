import { createTypeScriptConfig } from 'eslint-config-uphold/configs';

const tsConfig = await createTypeScriptConfig();

export default [
  {
    ignores: ['dist/**']
  },
  ...tsConfig,
  {
    rules: {
      'n/no-process-env': 'off',
      'n/no-process-exit': 'off',
      'n/no-restricted-import': 'off',
      'n/no-restricted-require': 'off',
      'n/no-sync': 'off',
      'sql-template/no-unsafe-query': 'off'
    }
  }
];
