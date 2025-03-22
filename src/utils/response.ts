export type SerializedResponse = {
  body: string;
  headers: Record<string, string>;
  status: number;
};

/**
 * Serialize a response to a serialized response.
 *
 * This function use `Response.clone()` to avoid mutating the original response.
 *
 * @param response - The response to serialize
 * @returns The serialized response
 */
export const cloneAndSerializeResponse = async (
  response: Response,
): Promise<SerializedResponse> => {
  const responseClone = response.clone();
  // DO NOT REFERENCE ANY PROPERTIES OF THE ORIGINAL RESPONSE OR YOU WILL BE FIRED

  return {
    body: await responseClone.text(),
    headers: Object.fromEntries(responseClone.headers.entries()),
    status: responseClone.status,
  };
};

/**
 * Deserialize a serialized response to a response.
 *
 * @param serializedResponse - The serialized response to deserialize
 * @returns Web standard response
 */
export const deserializeResponse = ({
  body,
  headers,
  status,
}: SerializedResponse): Response => {
  return new Response(body, {
    headers: new Headers(headers),
    status,
  });
};
