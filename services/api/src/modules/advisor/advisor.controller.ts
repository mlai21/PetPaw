import { Router } from 'express';
import { AdvisorService } from './advisor.service';

const advisorService = new AdvisorService();
export const advisorRouter = Router();

advisorRouter.post('/chat', async (req, res) => {
  const output = await advisorService.chat(req.body);
  res.json(output);
});
