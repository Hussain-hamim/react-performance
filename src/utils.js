import * as React from 'react'
import useInterval from 'use-interval'

// this prevent no to update on unmounted which can lead to memory leaks
function useSafeDispatch(dispatch) {
  const mounted = React.useRef(false)
  React.useLayoutEffect(() => {
    mounted.current = true
    return () => (mounted.current = false)
  }, [])
  return React.useCallback(
    (...args) => (mounted.current ? dispatch(...args) : void 0),
    [dispatch],
  )
}

// Example usage:
// const {data, error, status, run} = useAsync()
// React.useEffect(() => {
//   run(fetchPokemon(pokemonName))
// }, [pokemonName, run])
const defaultInitialState = {status: 'idle', data: null, error: null}

// design to help manage the state of an asynchronous operation, such as fetchin data
// from an api
function useAsync(initialState) {
  // maintain a persistent reference to the initial state, no re-render
  const initialStateRef = React.useRef({
    ...defaultInitialState,
    ...initialState,
  })

  const [{status, data, error}, setState] = React.useReducer(
    // the reducer function merges the current state(s) with an action(a),
    // this approach allow for partial updates to the state
    (s, a) => ({...s, ...a}),
    initialStateRef.current,
  )

  const safeSetState = useSafeDispatch(setState)

  // this fn is used to an async operation
  const run = React.useCallback(
    // the argument must be promise if not throw error
    promise => {
      if (!promise || !promise.then) {
        throw new Error(
          `The argument passed to useAsync().run must be a promise. Maybe a function that's passed isn't returning anything?`,
        )
      }

      safeSetState({status: 'pending'})

      return promise.then(
        data => {
          safeSetState({data, status: 'resolved'})
          return data
        },
        error => {
          safeSetState({status: 'rejected', error})
          return error
        },
      )
    },

    [safeSetState],
  )

  // this fns allow manual updating of the data and error
  // use useCallBack for preventing unnecessary re-renders
  const setData = React.useCallback(
    data => safeSetState({data}),
    [safeSetState],
  )
  const setError = React.useCallback(
    error => safeSetState({error}),
    [safeSetState],
  )

  ///
  const reset = React.useCallback(
    () => safeSetState(initialStateRef.current),
    [safeSetState],
  )

  return {
    // using the same names that react-query uses for convenience
    isIdle: status === 'idle',
    isLoading: status === 'pending',
    isError: status === 'rejected',
    isSuccess: status === 'resolved',

    setData,
    setError,
    error,
    status,
    data,
    run,
    reset,
  }
}

// useReducer is used with a simple incrementor but the state value is not used anywhere
// the second item returned by useReducer is the dispatch fn which when called trigger the reducer(re-render)
//since we only return dispatch fn ([1]) calling the useForceRerender() hook force a re-render by incrementing an internal state which is not read anywhere
const useForceRerender = () => React.useReducer(x => x + 1, 0)[1]

function debounce(cb, time) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(cb, time, ...args)
  }
}

// this only needs to exist because concurrent mode isn't here yet. When we get
// that then so much of our hack-perf fixes go away!

// this hook delay state update to optimize performance with frequent updates
function useDebouncedState(initialState) {
  const [state, setState] = React.useState(initialState)

  // this is to ensure that state changes only occur after 200ms of inactivity.
  // useCallback is used to memoized not recreate on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetState = React.useCallback(debounce(setState, 200), [])
  // the returned debouncedSetState mean updates are throttled
  return [state, debouncedSetState]
}

function Interval({onInterval, interval}) {
  useInterval(onInterval, interval)
  return null
}

function AppGrid({
  onUpdateGrid,
  rows,
  handleRowsChange,
  columns,
  handleColumnsChange,
  Cell,
}) {
  const [keepUpdated, setKeepUpdated] = React.useState(false)
  return (
    <div>
      <form onSubmit={e => e.preventDefault()}>
        <div>
          <button type="button" onClick={onUpdateGrid}>
            Update Grid Data
          </button>
        </div>

        <div>
          <label htmlFor="keepUpdated">Keep Grid Data updated</label>
          <input
            id="keepUpdated"
            checked={keepUpdated}
            type="checkbox"
            onChange={e => setKeepUpdated(e.target.checked)}
          />
          {keepUpdated ? (
            <Interval onInterval={onUpdateGrid} interval={500} />
          ) : null}
        </div>

        <div>
          <label htmlFor="rows">Rows to display: </label>
          <input
            id="rows"
            defaultValue={rows}
            type="number"
            min={1}
            max={100}
            onChange={e => handleRowsChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="columns">Columns to display: </label>
          <input
            id="columns"
            defaultValue={columns}
            type="number"
            min={1}
            max={100}
            onChange={e => handleColumnsChange(e.target.value)}
          />
        </div>
      </form>

      <div
        style={{
          width: '100%',
          maxWidth: 410,
          maxHeight: 820,
          overflow: 'scroll',
        }}
      >
        <div style={{width: columns * 40}}>
          {
            // Array.from is a method in js that create a new shallow-copied array from an array-like or
            // iterable object
            Array.from({length: rows}).map((r, row) => (
              <div key={row} style={{display: 'flex'}}>
                {Array.from({length: columns}).map((c, column) => (
                  <Cell key={column} row={row} column={column} />
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

function updateGridState(grid) {
  return grid.map(row => {
    return row.map(cell => (Math.random() > 0.7 ? Math.random() * 100 : cell))
  })
}

function updateGridCellState(grid, {row, column}) {
  // iterate over each rows
  return grid.map((cells, rI) => {
    // when it reaches a specific row
    if (rI === row) {
      // it then iterate over the cells in that row
      return cells.map((cell, cI) => {
        // the specific cell at the provided column index
        if (cI === column) {
          // is updated with a random value from 0 to 100
          return Math.random() * 100
        }
        // the other cells in the row remains unchanged also for rows
        return cell
      })
    }
    return cells
  })
}

export {
  useAsync,
  useForceRerender,
  useDebouncedState,
  Interval,
  AppGrid,
  updateGridState,
  updateGridCellState,
}
