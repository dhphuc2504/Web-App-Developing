// Local generation/validation only: deliberately does not load environment files.
import { defineConfig } from 'prisma/config';
export default defineConfig({schema:'prisma/schema.prisma',datasource:{url:'postgresql://local:local@127.0.0.1:5432/local'}});
