import express from 'express';
import { advisorRouter } from './modules/advisor/advisor.controller';

export const app = express();
app.use(express.json());
app.use('/advisor', advisorRouter);
