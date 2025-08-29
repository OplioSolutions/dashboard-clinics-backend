import { PostgrestQueryBuilder } from '@supabase/postgrest-js'

export type MockQueryBuilder = Partial<PostgrestQueryBuilder<any, any, any>> & {
  select?: jest.Mock
  insert?: jest.Mock
  update?: jest.Mock
  delete?: jest.Mock
  eq?: jest.Mock
  neq?: jest.Mock
  gt?: jest.Mock
  gte?: jest.Mock
  lt?: jest.Mock
  lte?: jest.Mock
  like?: jest.Mock
  ilike?: jest.Mock
  is?: jest.Mock
  in?: jest.Mock
  contains?: jest.Mock
  containedBy?: jest.Mock
  rangeLt?: jest.Mock
  rangeGt?: jest.Mock
  rangeGte?: jest.Mock
  rangeLte?: jest.Mock
  rangeAdjacent?: jest.Mock
  overlaps?: jest.Mock
  textSearch?: jest.Mock
  match?: jest.Mock
  not?: jest.Mock
  or?: jest.Mock
  filter?: jest.Mock
  order?: jest.Mock
  limit?: jest.Mock
  range?: jest.Mock
  single?: jest.Mock
  maybeSingle?: jest.Mock
}
