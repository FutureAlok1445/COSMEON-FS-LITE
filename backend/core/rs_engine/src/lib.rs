use pyo3::prelude::*;
use pyo3::types::PyBytes;
use pyo3::exceptions::PyValueError;
use reed_solomon_erasure::galois_8::ReedSolomon;

/// Encode a buffer of data chunks into data + parity chunks using Galois Field 2^8.
/// Returns a list of all chunks (data followed by parity).
#[pyfunction]
fn encode_shards(py: Python, data_shards: Vec<&[u8]>, data_count: usize, parity_count: usize) -> PyResult<Vec<Py<PyBytes>>> {
    if data_shards.len() != data_count {
        return Err(PyValueError::new_err("Mismatch between data_shards length and data_count"));
    }
    
    let rs = ReedSolomon::new(data_count, parity_count)
        .map_err(|e| PyValueError::new_err(format!("RS Init Error: {:?}", e)))?;

    // Clone into a mutable matrix
    let mut shards: Vec<Vec<u8>> = data_shards.into_iter().map(|s| s.to_vec()).collect();
    let shard_size = shards[0].len();
    
    // Allocate empty parity shards
    for _ in 0..parity_count {
        shards.push(vec![0; shard_size]);
    }
    
    // Hardware accelerated ISA-L routine if feature flag enabled during compilation
    rs.encode(&mut shards)
        .map_err(|e| PyValueError::new_err(format!("Encode Error: {:?}", e)))?;

    // Convert back to Python Bytes
    let py_shards: Vec<Py<PyBytes>> = shards
        .into_iter()
        .map(|s| PyBytes::new_bound(py, &s).into())
        .collect();

    Ok(py_shards)
}

/// A Python module implemented in Rust.
#[pymodule]
fn cosmeon_rs_engine(_py: Python, m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(encode_shards, m)?)?;
    Ok(())
}
