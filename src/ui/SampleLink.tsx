import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data/dataContext';
import { useSampleData } from './useSampleData';

/**
 * Makes a demo link like `…/#/?sample` open straight into the sample data. It only loads on a
 * device with no entries, so following the link can never mix examples into real data.
 * The parameter is then dropped from the address.
 */
export function SampleLink() {
  const { loading, entries } = useData();
  const { load } = useSampleData();
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);
  const wanted = params.has('sample');

  useEffect(() => {
    if (loading || !wanted || handled.current) return;
    handled.current = true;
    const run = async () => {
      if (entries.length === 0) await load();
      setParams(
        (p) => {
          p.delete('sample');
          return p;
        },
        { replace: true },
      );
    };
    void run();
  }, [loading, wanted, entries.length, load, setParams]);

  return null;
}
