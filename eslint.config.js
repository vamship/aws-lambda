import tselPlugin from '@typescript-eslint/eslint-plugin';
import tselParser from '@typescript-eslint/parser';
import _js from '@eslint/js';

const tselRules = tselPlugin.configs.recommended.rules;

function mapRuleNamespace(rules, sourceNamespace, targetNamespace) {
    const pattern = new RegExp(sourceNamespace);
    return Object.keys(rules).reduce((result, key) => {
        const newKey = key.replace(pattern, targetNamespace);
        result[newKey] = rules[key];
        return result;
    }, {});
}

const commonRules = {
    semi: 'error',
    'no-trailing-spaces': 'error',
};

export default [
    _js.configs.recommended,
    {
        files: ['**/*.js', '**/*.jsx'],
        languageOptions: {
            globals: {
                console: true,
                it: true,
                describe: true,
                setInterval: true,
                clearInterval: true,
                beforeEach: true,
                setTimeout: true,
            },
        },
        rules: {
            ...commonRules,
            'no-unused-vars': ['error', { args: 'none' }],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tselParser,
            globals: {
                console: true,
                it: true,
                describe: true,
                setInterval: true,
                clearInterval: true,
                beforeEach: true,
                afterEach: true,
                process: true,
                setTimeout: true,
            },
        },
        plugins: {
            tsel: tselPlugin,
        },
        rules: Object.assign(
            mapRuleNamespace(tselRules, '@typescript-eslint', 'tsel'),
            {
                ...commonRules,
                'tsel/no-unused-vars': ['error', { args: 'none' }],
            }
        ),
    },
];
