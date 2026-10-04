r"""
=============================================================================
ALGORITHMIC COMPONENT: HYBRID EXTRACTIVE-ABSTRACTIVE SUMMARIZATION
Algorithm: Maximal Marginal Relevance (MMR) with Vector Space Cosine Similarity
Author: Lương Việt Anh (Lead AI & Orchestration)

Mathematical Formulation:
-------------------------
Given a meeting transcript consisting of a set of sentences R, and a set of
currently selected key sentences S, the next sentence s* to extract is chosen by
maximizing the MMR score:

    MMR(s) = argmax_{s_i in R \ S} [ lambda * Sim1(s_i, Q) - (1 - lambda) * max_{s_j in S} Sim2(s_i, s_j) ]

Where:
  - Q is the document centroid vector (representing the global meeting theme).
  - Sim1(s_i, Q) is the cosine similarity measuring informational relevance.
  - max_{s_j in S} Sim2(s_i, s_j) measures redundancy against already selected sentences.
  - lambda in [0, 1] is the diversity-relevance trade-off hyperparameter (default: 0.65).
  - Selection: O(K * N) sparse cosine comparisons, where N is sentence count and K
    is selected count. Each comparison also costs sparse-vector traversal; K proportional
    to N still yields quadratic selection work.
=============================================================================
"""

import re
import math
from typing import List, Dict, Tuple, Set, Any, Optional


class MMRExtractor:
    """
    High-performance, pure-Python/NumPy-free vector space model implementing
    Maximal Marginal Relevance (Carbonell & Goldstein, 1998) for meeting transcript
    redundancy elimination.
    """

    DEFAULT_STOPWORDS: Set[str] = {
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
        "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
        "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
        "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
        "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
        "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
        "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
        "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
        "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
        "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
        "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
        "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
        "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll",
        "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's",
        "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't",
        "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
        # Common meeting filler words in conversational speech (English)
        "um", "uh", "like", "yeah", "okay", "right", "know", "well", "actually", "basically",
        "uhm", "yep", "hmm", "gonna", "wanna", "sort", "kind",
        # Common meeting filler words & stopwords in conversational speech (Vietnamese)
        "và", "là", "của", "cho", "trong", "với", "các", "có", "được", "này", "thì", "đã",
        "khi", "sẽ", "đang", "như", "để", "nhưng", "tại", "một", "về", "ra", "vào", "lại",
        "dạ", "vâng", "ạ", "ờ", "ừ", "mà", "nhỉ", "nhé", "nè", "thôi", "luôn", "rồi"
    }

    def __init__(self, lambda_param: float = 0.65, stopwords: Set[str] = None):
        """
        Args:
            lambda_param (float): Balances relevance (1.0) vs diversity (0.0). Standard: 0.65.
            stopwords (Set[str]): Custom stopword set to filter lexical noise.
        """
        self.lambda_param = lambda_param
        self.stopwords = stopwords or self.DEFAULT_STOPWORDS

    @staticmethod
    def split_into_sentences(text: str) -> List[str]:
        """
        Decomposes transcript into conversational sentences using regex boundaries
        while preserving speaker tags (e.g. 'Speaker A:', 'John:'), avoiding false splits
        on numbers ($50,000 or 3.14) or abbreviations.
        """
        # Split on sentence terminals preceded by non-digits, or newlines
        raw_sentences = re.split(r'(?<=[a-zA-Z\u00C0-\u1EF9][.?!])\s+|\n+', text)
        sentences = [s.strip() for s in raw_sentences if len(s.strip()) >= 8]
        return sentences

    def _tokenize(self, text: str) -> List[str]:
        """Lowercases and cleans tokens, supporting Unicode (Vietnamese, etc.) and English."""
        words = re.findall(r'[\w\'-]+', text.lower())
        return [w for w in words if w not in self.stopwords and len(w) > 1]

    def _compute_tf_idf(self, sentences: List[str]) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
        """
        Builds sparse TF-IDF vector space representation for all sentences and calculates
        the global centroid vector Q for the entire meeting.
        """
        doc_count = len(sentences)
        tokenized_sentences = [self._tokenize(s) for s in sentences]

        # 1. Document Frequency (DF)
        df: Dict[str, int] = {}
        for tokens in tokenized_sentences:
            unique_tokens = set(tokens)
            for token in unique_tokens:
                df[token] = df.get(token, 0) + 1

        # 2. IDF calculation: idf(t) = log((1 + N) / (1 + df(t))) + 1
        idf: Dict[str, float] = {}
        for token, count in df.items():
            idf[token] = math.log((1.0 + doc_count) / (1.0 + count)) + 1.0

        # 3. TF-IDF vectors for each sentence
        vectors: List[Dict[str, float]] = []
        centroid: Dict[str, float] = {}

        for tokens in tokenized_sentences:
            tf: Dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1

            vec: Dict[str, float] = {}
            for token, count in tf.items():
                val = (count / max(len(tokens), 1)) * idf.get(token, 1.0)
                vec[token] = val
                centroid[token] = centroid.get(token, 0.0) + val

            vectors.append(vec)

        # Average centroid vector Q over all sentences
        if doc_count > 0:
            for token in centroid:
                centroid[token] /= doc_count

        return vectors, centroid

    @staticmethod
    def _cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        """Computes Cosine Similarity between two sparse vectors in O(min(|vec1|, |vec2|))."""
        if not vec1 or not vec2:
            return 0.0

        # Iterate over the smaller vector for computational efficiency
        small, large = (vec1, vec2) if len(vec1) < len(vec2) else (vec2, vec1)
        dot_product = sum(weight * large.get(term, 0.0) for term, weight in small.items())

        norm1 = math.sqrt(sum(w * w for w in vec1.values()))
        norm2 = math.sqrt(sum(w * w for w in vec2.values()))

        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def extract_key_sentences(
        self,
        transcript: str,
        target_ratio: float = 0.50,
        min_sentences: int = 5,
        lambda_param: Optional[float] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Executes MMR selection to eliminate conversational redundancy while preserving
        chronological flow and essential decision points.

        Args:
            transcript (str): Raw transcribed meeting text.
            target_ratio (float): Fraction of content to retain (0.50 = retain top 50%).
            min_sentences (int): Minimum sentences to keep.
            lambda_param (Optional[float]): Dynamic override for diversity-relevance balance.

        Returns:
            Tuple[str, Dict[str, Any]]:
                - filtered_transcript: High-density condensed transcript.
                - telemetry: Detailed algorithmic metrics (compression, word counts, latency).
        """
        active_lambda = lambda_param if lambda_param is not None else self.lambda_param
        sentences = self.split_into_sentences(transcript)
        total_sentences = len(sentences)
        original_words = len(transcript.split())

        # If transcript is already concise, return unchanged
        if total_sentences <= min_sentences or original_words < 60:
            return transcript, {
                "applied": False,
                "reason": "Transcript already compact (< 60 words)",
                "original_words": original_words,
                "filtered_words": original_words,
                "compression_ratio": 1.0,
                "reduction_percent": 0.0,
                "sentences_kept": total_sentences,
                "total_sentences": total_sentences,
                "lambda_param": active_lambda
            }

        k = max(min_sentences, int(math.ceil(total_sentences * target_ratio)))
        k = min(k, total_sentences)

        vectors, centroid = self._compute_tf_idf(sentences)

        # Unselected sentences pool R \ S
        remaining_indices = list(range(total_sentences))
        selected_indices: List[int] = []
        relevance = [self._cosine_similarity(vector, centroid) for vector in vectors]
        redundancy = [0.0] * total_sentences

        # MMR Iterative Selection
        for _ in range(k):
            best_score = -float('inf')
            best_idx = None

            for i in remaining_indices:
                # Sim1: Informational relevance to meeting centroid Q
                sim_to_doc = relevance[i]
                max_sim_to_selected = redundancy[i]

                # MMR Objective function: lambda * Sim1 - (1 - lambda) * Sim2
                mmr_score = (active_lambda * sim_to_doc) - ((1.0 - active_lambda) * max_sim_to_selected)

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = i

            if best_idx is not None:
                selected_indices.append(best_idx)
                remaining_indices.remove(best_idx)
                for i in remaining_indices:
                    redundancy[i] = max(redundancy[i], self._cosine_similarity(vectors[i], vectors[best_idx]))

        # Sort selected sentences back to original chronological order to preserve meeting dialogue flow
        selected_indices.sort()
        filtered_sentences = [sentences[i] for i in selected_indices]
        filtered_transcript = "\n\n".join(filtered_sentences)
        filtered_words = len(filtered_transcript.split())

        reduction = round((1.0 - (filtered_words / max(original_words, 1))) * 100, 1)

        telemetry = {
            "applied": True,
            "algorithm": "Maximal Marginal Relevance (MMR) + TF-IDF Cosine Centroid",
            "lambda_param": active_lambda,          # key used by UI display
            "lambda_diversity": active_lambda,      # alias for backwards compat
            "original_words": original_words,
            "filtered_words": filtered_words,
            "reduction_percent": reduction,
            "sentences_kept": len(selected_indices),
            "total_sentences": total_sentences,
            "compression_ratio": round(filtered_words / max(original_words, 1), 2)
        }

        return filtered_transcript, telemetry


# Singleton instance for efficient module reuse
default_extractor = MMRExtractor(lambda_param=0.65)


def filter_meeting_transcript(
    transcript: str, 
    target_ratio: float = 0.55,
    lambda_param: float = 0.65
) -> Tuple[str, Dict[str, Any]]:
    """Convenience wrapper for orchestrator pipeline integration."""
    return default_extractor.extract_key_sentences(
        transcript, 
        target_ratio=target_ratio, 
        lambda_param=lambda_param
    )
