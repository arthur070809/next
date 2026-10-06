export type DemoScriptEnvironment = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DEMO_DB_NOME?: string;
};

export type DemoDatabaseTarget = {
  host: string;
  database: string;
};

export function assertSafeDemoScript(
  args: string[],
  environment?: DemoScriptEnvironment,
  allowedArgs?: string[],
): DemoDatabaseTarget;
