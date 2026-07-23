import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface TestLoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface Child {
  id: string;
}

interface LearningGoal {
  id: string;
  title: string;
}

interface FastFlowBook {
  bookId: string;
  pdfKey: string;
}

async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  accessToken: string | null,
  data: unknown,
): Promise<T> {
  const res = await request.post(`${API_URL}${path}`, {
    data,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  expect(res.ok(), `POST ${path} failed: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json() as Promise<T>;
}

async function apiGet<T>(
  request: APIRequestContext,
  path: string,
  accessToken: string,
): Promise<T> {
  const res = await request.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok(), `GET ${path} failed: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json() as Promise<T>;
}

test('logs in, creates a fast-flow book, and the finished book page shows a PDF download button', async ({
  page,
  request,
}) => {
  const { accessToken } = await apiPost<TestLoginResponse>(request, '/auth/test-login', null, {});

  const child = await apiPost<Child>(request, '/children', accessToken, {
    name: 'E2E Тест',
    age: 5,
  });

  const goals = await apiGet<LearningGoal[]>(
    request,
    `/learning-goals?childId=${child.id}`,
    accessToken,
  );
  const goal = goals.find((g) => g.title.includes('Делиться'));
  expect(
    goal,
    'seeded "Делиться" learning goal (has a fast-flow Template) not found',
  ).toBeDefined();

  const book = await apiPost<FastFlowBook>(request, '/books', accessToken, {
    childId: child.id,
    learningGoalId: goal!.id,
    mode: 'fast',
  });
  expect(book.pdfKey).toBeTruthy();

  await page.addInitScript((token: string) => {
    window.localStorage.setItem('sg_access_token', token);
  }, accessToken);

  await page.goto(`/books/${book.bookId}`);
  await expect(page.getByRole('button', { name: 'Скачать PDF' })).toBeVisible();
});
