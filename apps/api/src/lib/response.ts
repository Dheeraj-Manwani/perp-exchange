import type { Response } from "express";

export function ok<T>(res: Response, data: T, message?: string) {
  res.status(200).json({ success: true, data, ...(message && { message }) });
}

export function created<T>(res: Response, data: T, message?: string) {
  res.status(201).json({ success: true, data, ...(message && { message }) });
}

export function noContent(res: Response) {
  res.status(204).send();
}